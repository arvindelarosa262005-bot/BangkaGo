-- Public invalidation signals contain no record identifiers, contacts, amounts or documents.
create table public.live_events(id uuid primary key default gen_random_uuid(),scope text not null check(scope in ('catalog','access','settings','account')),created_at timestamptz not null default now());
create index live_events_created_idx on public.live_events(created_at);
alter table public.live_events enable row level security;
revoke all on public.live_events from anon,authenticated;
grant select on public.live_events to anon,authenticated;
grant all on public.live_events to service_role;
create policy public_live_signal on public.live_events for select to anon,authenticated using(scope in ('catalog','access','settings') and created_at>now()-interval '15 minutes');
create policy account_live_signal on public.live_events for select to authenticated using(scope='account' and private.is_active() and created_at>now()-interval '15 minutes');
create table private.live_transactions(transaction_id bigint not null,scope text not null,created_at timestamptz not null default now(),primary key(transaction_id,scope));
create index live_transactions_created_idx on private.live_transactions(created_at);
revoke all on private.live_transactions from public,anon,authenticated;
create function private.signal_live_change() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into private.live_transactions(transaction_id,scope) values(txid_current(),TG_ARGV[0]) on conflict do nothing;
 if found then insert into public.live_events(scope) values(TG_ARGV[0]);end if;
 return null;end$$;
revoke all on function private.signal_live_change() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['boats','boat_images','boat_documents','boat_schedules','bookings','boat_owners','routes','locations','reviews','document_requirements'] loop
 execute format('create trigger signal_catalog after insert or update or delete on public.%I for each row execute function private.signal_live_change(''catalog'')',t);
 end loop;
end$$;
create trigger signal_access after update of account_status,role,display_name on public.profiles for each row execute function private.signal_live_change('access');
create trigger signal_commission after insert or update or delete on public.commission_rules for each row execute function private.signal_live_change('settings');
create trigger signal_settings after insert or update or delete on public.app_settings for each row execute function private.signal_live_change('settings');
do $$declare t text;begin
 foreach t in array array['profiles','payments','platform_commissions','refunds','payouts','notifications','support_tickets','admin_audit_logs','saved_boats'] loop
 execute format('create trigger signal_account after insert or update or delete on public.%I for each row execute function private.signal_live_change(''account'')',t);
 end loop;
end$$;

-- Never publish private records, including DELETE keys which Postgres Changes cannot RLS-filter.
-- Only nonce/scope/time invalidations are streamed. Clients refetch their permitted snapshots.
do $$declare t text;begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime;end if;
 foreach t in array array['profiles','boat_owners','boats','boat_images','boat_documents','locations','routes','boat_schedules','bookings','payments','commission_rules','platform_commissions','refunds','payouts','reviews','notifications','support_tickets','admin_audit_logs','app_settings','saved_boats','document_requirements'] loop
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime drop table public.%I',t);end if;
 end loop;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_events') then alter publication supabase_realtime add table public.live_events;end if;
end$$;
create function public.realtime_health() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('ready',
  current_setting('wal_level')='logical'
  and exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_events')
  and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=any(array['profiles','boat_owners','boats','boat_images','boat_documents','locations','routes','boat_schedules','bookings','payments','commission_rules','platform_commissions','refunds','payouts','reviews','notifications','support_tickets','admin_audit_logs','app_settings','saved_boats','document_requirements']))
  and (select count(distinct c.relname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname in ('signal_catalog','signal_access','signal_account','signal_commission','signal_settings') and t.tgenabled<>'D')=21
 )$$;
revoke all on function public.realtime_health() from public;
grant execute on function public.realtime_health() to anon,authenticated,service_role;
create function public.prune_live_events() returns bigint language plpgsql security definer set search_path='' as $$declare n bigint;begin delete from public.live_events where created_at<now()-interval '1 day';get diagnostics n=row_count;delete from private.live_transactions where created_at<now()-interval '1 day';return n;end$$;
revoke all on function public.prune_live_events() from public,anon,authenticated;
grant execute on function public.prune_live_events() to service_role;

-- A public schedule exposes only the next availability boundary, never a private booking.
drop function public.available_schedules();
create function public.available_schedules() returns table(id uuid,boat_id uuid,boat_name text,boat_type text,description text,capacity int,mode text,price_minor bigint,starts_at timestamptz,ends_at timestamptz,origin text,destination text,remaining int,photo_path text,owner_name text,cancellation_policy text,next_change_at timestamptz) language sql stable security definer set search_path='' as $$
 select s.id,b.id,b.name,b.boat_type,b.description,s.capacity,s.mode,s.price_minor,s.starts_at,s.ends_at,o.name,d.name,
 greatest(0,s.capacity-coalesce((select sum(case when x.mode='charter' then s.capacity else x.passenger_count end)::int from public.bookings x where x.schedule_id=s.id and (x.status in ('confirmed','completed') or (x.status in ('pending_owner_confirmation','awaiting_payment') and x.reservation_expires_at>now()))),0)),
 (select i.storage_path from public.boat_images i where i.boat_id=b.id order by i.created_at limit 1),p.display_name,b.cancellation_policy,
 least(s.starts_at,(select min(x.reservation_expires_at) from public.bookings x where x.schedule_id=s.id and x.status in ('pending_owner_confirmation','awaiting_payment') and x.reservation_expires_at>now()),(select min(c.effective_at) from public.commission_rules c where c.effective_at>now()))
 from public.boat_schedules s join public.boats b on b.id=s.boat_id join public.profiles p on p.id=b.owner_id join public.routes r on r.id=s.route_id join public.locations o on o.id=r.origin_id join public.locations d on d.id=r.destination_id
 where private.visible_boat(b.id) and s.status='open' and s.starts_at>now() and r.active and o.active and d.active $$;
revoke all on function public.available_schedules() from public;
grant execute on function public.available_schedules() to anon,authenticated;
create or replace function private.quote_booking(p_schedule uuid,p_count int) returns jsonb language plpgsql stable security definer set search_path='' as $$declare s public.boat_schedules;r public.commission_rules;v_base bigint;begin
 select * into s from public.boat_schedules where id=p_schedule and status='open' and starts_at>now();
 if not found or not private.visible_boat(s.boat_id) or p_count<1 or p_count>s.capacity then raise exception 'Invalid or unavailable schedule';end if;
 select * into r from public.commission_rules where effective_at<=now() order by effective_at desc limit 1;if not found then raise exception 'Fee configuration required';end if;
 v_base:=s.price_minor*case when s.mode='seat' then p_count else 1 end;
 return jsonb_build_object('base_minor',v_base,'service_fee_minor',r.service_fee_minor,'total_minor',v_base+r.service_fee_minor,'currency','PHP','next_change_at',(select min(c.effective_at) from public.commission_rules c where c.effective_at>now()));end$$;
notify pgrst,'reload schema';
