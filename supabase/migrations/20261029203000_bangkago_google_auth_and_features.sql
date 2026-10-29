-- Support Google OAuth user metadata (full_name / name) and self-service passenger -> boat owner activation.
create or replace function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_name text;
 v_role text;
begin
 v_name := left(
  coalesce(
   nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
   nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
   nullif(trim(new.raw_user_meta_data->>'name'), ''),
   'New traveller'
  ),
  80
 );
 if length(v_name) < 2 then
  v_name := 'New traveller';
 end if;
 v_role := case when new.raw_user_meta_data->>'role' = 'owner' then 'owner' else 'passenger' end;
 insert into public.profiles(id, display_name, role)
 values(new.id, v_name, v_role);
 if v_role = 'owner' then
  insert into public.boat_owners(id) values(new.id) on conflict(id) do nothing;
 end if;
 return new;
end$$;

create or replace function private.register_as_owner() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active() then
  raise exception 'Active signed-in account required';
 end if;
 update public.profiles
 set role = 'owner', updated_at = now()
 where id = auth.uid() and role = 'passenger' and account_status = 'active';
 insert into public.boat_owners(id)
 values(auth.uid())
 on conflict(id) do nothing;
 insert into public.notifications(user_id, title, body)
 values(auth.uid(), 'Boat operator workspace enabled', 'You can now register your boat and upload verification documents.');
end$$;

create or replace function public.register_as_owner() returns void language sql security invoker set search_path='' as $$
 select private.register_as_owner()
$$;

revoke all on function private.register_as_owner(), public.register_as_owner() from public, anon;
grant execute on function private.register_as_owner(), public.register_as_owner() to authenticated;

create or replace function private.admin_action(p_action text,p_id uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$declare v_ref text;begin
 if not private.is_admin() then raise exception 'Administrator required';end if;
 if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Reason required';end if;
 if p_action='account_status' then
  if p_id=auth.uid() or p_data->>'status' not in ('active','suspended') then raise exception 'Invalid account change';end if;
  update public.profiles set account_status=p_data->>'status',updated_at=now() where id=p_id and role<>'admin';
 elsif p_action='commission' then insert into public.commission_rules(rate_bps,service_fee_minor,effective_at) values((p_data->>'rate_bps')::int,(p_data->>'service_fee_minor')::bigint,(p_data->>'effective_at')::timestamptz);
 elsif p_action='payout_settle' then
  v_ref:=trim(p_data->>'bank_reference');if length(v_ref)<6 then raise exception 'Verified bank reference required';end if;
  perform 1 from public.bookings b join public.payouts p on p.booking_id=b.id where p.id=p_id and b.status='completed' for update of b;
  if not found then raise exception 'Only completed, non-refunded trips can be settled';end if;
  if not exists(select 1 from public.platform_commissions c join public.payouts p on p.booking_id=c.booking_id where p.id=p_id and c.processing_fee_minor is not null and c.operator_minor=p.amount_minor) then raise exception 'Provider processing fees must be reconciled before payout settlement';end if;
  update public.payouts set status='settled',bank_reference=v_ref,settled_at=now() where id=p_id and status='pending';
  if not found then raise exception 'Payout has already been settled or is unavailable';end if;
  update public.platform_commissions set reconciliation_status='reconciled' where booking_id=(select booking_id from public.payouts where id=p_id);
 elsif p_action='support_investigate' then update public.support_tickets set status='investigating' where id=p_id;
 elsif p_action='support_resolve' then update public.support_tickets set status='resolved' where id=p_id;
 else raise exception 'Unsupported administrative action';end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,reason,summary) values(auth.uid(),p_action,p_id,p_data->>'reason',p_data-'reason');end$$;

notify pgrst,'reload schema';

