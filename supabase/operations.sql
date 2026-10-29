alter table public.boats add constraint fare_limits check(charter_price_minor<=100000000 and seat_price_minor<=100000000);
alter table public.boat_schedules add constraint schedule_fare_limit check(price_minor<=100000000);
alter table public.commission_rules add constraint service_fee_limit check(service_fee_minor<=100000000);
create function private.quote_booking(p_schedule uuid,p_count int) returns jsonb language plpgsql stable security definer set search_path='' as $$declare s public.boat_schedules;r public.commission_rules;v_base bigint;begin
 select * into s from public.boat_schedules where id=p_schedule and status='open' and starts_at>now();
 if not found or not private.visible_boat(s.boat_id) or p_count<1 or p_count>s.capacity then raise exception 'Invalid or unavailable schedule';end if;
 select * into r from public.commission_rules where effective_at<=now() order by effective_at desc limit 1;if not found then raise exception 'Fee configuration required';end if;
 v_base:=s.price_minor*case when s.mode='seat' then p_count else 1 end;
 return jsonb_build_object('base_minor',v_base,'service_fee_minor',r.service_fee_minor,'total_minor',v_base+r.service_fee_minor,'currency','PHP');end$$;
create function public.quote_booking(p_schedule uuid,p_count int) returns jsonb language sql security invoker set search_path='' as $$select private.quote_booking(p_schedule,p_count)$$;
create function private.set_boat_active(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not private.owns_boat(p_id) then raise exception 'Owner required';end if;
 perform 1 from public.boats where id=p_id for update;
 update public.boats set active=not active,updated_at=now() where id=p_id and verification_status='approved';if not found then raise exception 'Approved boat required';end if;end$$;
create function public.set_boat_active(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.set_boat_active(p_id)$$;
create function private.close_schedule(p_id uuid) returns void language plpgsql security definer set search_path='' as $$declare v_boat uuid;begin
 select boat_id into v_boat from public.boat_schedules where id=p_id;
 if not private.owns_boat(v_boat) then raise exception 'Owner required';end if;
 perform 1 from public.boats where id=v_boat for update;
 update public.boat_schedules set status='closed' where id=p_id;end$$;
create function public.close_schedule(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.close_schedule(p_id)$$;
create table private.rate_limits(user_id uuid not null,bucket text not null,window_start timestamptz not null,hits int not null,primary key(user_id,bucket,window_start));
create function public.consume_rate_limit(p_user uuid,p_bucket text,p_limit int) returns boolean language plpgsql security definer set search_path='' as $$declare v_hits int;begin
 insert into private.rate_limits(user_id,bucket,window_start,hits) values(p_user,p_bucket,date_trunc('minute',now()),1) on conflict(user_id,bucket,window_start) do update set hits=private.rate_limits.hits+1 returning hits into v_hits;return v_hits<=p_limit;end$$;
create function private.confirm_refund(p_id uuid,p_reference text,p_amount bigint) returns void language plpgsql security definer set search_path='' as $$declare r public.refunds;b public.bookings;begin
 select * into r from public.refunds where id=p_id;if not found then raise exception 'Refund not found';end if;
 select * into b from public.bookings where id=r.booking_id for update;
 select * into r from public.refunds where id=p_id for update;
 if r.amount_minor<>p_amount or r.provider_reference is distinct from p_reference then raise exception 'Refund reference or amount mismatch';end if;
 if r.status='confirmed' then return;end if;
 if exists(select 1 from public.payouts where booking_id=b.id and status='settled') then raise exception 'Settled payout requires financial investigation';end if;
 update public.refunds set status='confirmed' where id=p_id;
 update public.payments set status='refunded',updated_at=now() where id=r.payment_id;
 update public.bookings set status='refunded',updated_at=now() where id=r.booking_id;
 update public.platform_commissions set reconciliation_status='reversed',adjustment_minor=commission_minor+service_fee_minor where booking_id=r.booking_id;
 delete from public.payouts where booking_id=r.booking_id and status='pending';
 insert into public.notifications(user_id,title,body) values(b.passenger_id,'Refund verified',b.reference||' has been refunded by the payment provider.');end$$;
create function public.confirm_refund(p_id uuid,p_reference text,p_amount bigint) returns void language sql security invoker set search_path='' as $$select private.confirm_refund(p_id,p_reference,p_amount)$$;
-- Refund and checkout claims are durable: uncertain provider outcomes require reconciliation,
-- never an automatic second money movement.
create function public.claim_refund(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.bookings where id=(select booking_id from public.refunds where id=p_id) for update;
 update public.refunds set status='processing' where id=p_id and status='requested';return found;end$$;
create function public.claim_checkout(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 update public.payments set status='pending',updated_at=now() where id=p_id and status='creating';return found;end$$;
create function public.expire_reservations() returns int language plpgsql security definer set search_path='' as $$declare v_count int;begin
 update public.bookings set status='expired',updated_at=now() where status in ('pending_owner_confirmation','awaiting_payment') and reservation_expires_at<=now();get diagnostics v_count=row_count;return v_count;end$$;
revoke all on all functions in schema private from public;
revoke all on function public.quote_booking(uuid,int),public.set_boat_active(uuid),public.close_schedule(uuid),public.consume_rate_limit(uuid,text,int),public.claim_refund(uuid),public.claim_checkout(uuid),public.confirm_refund(uuid,text,bigint),public.expire_reservations() from public,anon,authenticated;
grant execute on function private.quote_booking(uuid,int),public.quote_booking(uuid,int) to anon,authenticated;
grant execute on function private.set_boat_active(uuid),public.set_boat_active(uuid),private.close_schedule(uuid),public.close_schedule(uuid) to authenticated;
grant execute on function public.consume_rate_limit(uuid,text,int),public.claim_refund(uuid),public.claim_checkout(uuid),private.confirm_refund(uuid,text,bigint),public.confirm_refund(uuid,text,bigint),public.expire_reservations() to service_role;

create function private.configure_platform(p_kind text,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$declare v_id uuid;begin
 if not private.is_admin() then raise exception 'Administrator required';end if;
 if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Reason required';end if;
 if p_kind='location' then
  if length(trim(coalesce(p_data->>'name','')))<2 or length(trim(coalesce(p_data->>'municipality','')))<2 then raise exception 'Location name and municipality required';end if;
  insert into public.locations(name,municipality,province) values(left(trim(p_data->>'name'),150),left(trim(p_data->>'municipality'),150),left(trim(p_data->>'province'),150)) returning id into v_id;
 elsif p_kind='route' then
  insert into public.routes(origin_id,destination_id) values((p_data->>'origin_id')::uuid,(p_data->>'destination_id')::uuid) returning id into v_id;
 elsif p_kind='requirement' then
  if length(trim(coalesce(p_data->>'name','')))<3 then raise exception 'Requirement name required';end if;
  insert into public.document_requirements(name) values(left(trim(p_data->>'name'),150)) returning id into v_id;
 elsif p_kind='setting' then
  if p_data->>'key' not in ('platform_name','cancellation_policy','document_notice','privacy_contact') or length(coalesce(p_data->>'value','')) not between 2 and 4000 then raise exception 'Unsupported setting or invalid value';end if;
  insert into public.app_settings(key,value) values(p_data->>'key',to_jsonb(p_data->>'value')) on conflict(key) do update set value=excluded.value,updated_at=now();
 else raise exception 'Unsupported configuration type';end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,reason,summary) values(auth.uid(),'configure.'||p_kind,v_id,p_data->>'reason',p_data-'reason');end$$;
create function public.configure_platform(p_kind text,p_data jsonb) returns void language sql security invoker set search_path='' as $$select private.configure_platform(p_kind,p_data)$$;
revoke all on function private.configure_platform(text,jsonb),public.configure_platform(text,jsonb) from public,anon;
grant execute on function private.configure_platform(text,jsonb),public.configure_platform(text,jsonb) to authenticated;
grant select on public.app_settings to anon;
create policy public_policy_read on public.app_settings for select to anon,authenticated using(key in ('platform_name','cancellation_policy','document_notice','privacy_contact'));
create function private.touch_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$begin new.updated_at:=now();return new;end$$;
revoke all on function private.touch_updated_at() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['profiles','boats','bookings','payments','app_settings'] loop execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);end loop;end$$;

create function private.record_provider_fee(p_payment uuid,p_fee bigint) returns void language plpgsql security definer set search_path='' as $$declare p public.payments;b public.bookings;c public.platform_commissions;begin
 select * into p from public.payments where id=p_payment;
 if not found or p.status<>'paid' or p_fee<0 or p_fee>p.amount_minor then raise exception 'Invalid verified processing fee';end if;
 select * into b from public.bookings where id=p.booking_id for update;
 select * into c from public.platform_commissions where booking_id=p.booking_id for update;
 if not found then return;end if;
 if c.processing_fee_minor is not null and c.processing_fee_minor<>p_fee then raise exception 'Processing fee changed; finance investigation required';end if;
 if p_fee>b.operator_minor then raise exception 'Processing fee exceeds operator payable; finance investigation required';end if;
 update public.platform_commissions set processing_fee_minor=p_fee,operator_minor=b.operator_minor-p_fee where booking_id=p.booking_id;
 update public.payouts set amount_minor=b.operator_minor-p_fee where booking_id=p.booking_id and status='pending';end$$;
create function public.record_provider_fee(p_payment uuid,p_fee bigint) returns void language sql security invoker set search_path='' as $$select private.record_provider_fee(p_payment,p_fee)$$;
revoke all on function private.record_provider_fee(uuid,bigint),public.record_provider_fee(uuid,bigint) from public,anon,authenticated;
grant execute on function private.record_provider_fee(uuid,bigint),public.record_provider_fee(uuid,bigint) to service_role;
