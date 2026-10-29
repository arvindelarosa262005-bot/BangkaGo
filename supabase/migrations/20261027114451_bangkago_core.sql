-- Source for the initial migration; generated migration is the deployment artifact.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
create table public.profiles(id uuid primary key references auth.users(id),display_name text not null check(length(display_name) between 2 and 80),phone text,role text not null default 'passenger' check(role in ('passenger','owner','admin')),account_status text not null default 'active' check(account_status in ('active','suspended')),push_token text,notifications_enabled boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.boat_owners(id uuid primary key references profiles(id),verification_status text not null default 'submitted' check(verification_status in ('submitted','approved','rejected','suspended')),created_at timestamptz not null default now());
create table public.locations(id uuid primary key default gen_random_uuid(),name text not null unique,municipality text not null,province text not null default 'Occidental Mindoro',active boolean not null default true);
create table public.routes(id uuid primary key default gen_random_uuid(),origin_id uuid not null references locations,destination_id uuid not null references locations,active boolean not null default true,check(origin_id<>destination_id),unique(origin_id,destination_id));
create table public.boats(id uuid primary key default gen_random_uuid(),owner_id uuid not null references boat_owners(id),name text not null check(length(name) between 2 and 100),description text not null default '',boat_type text not null check(boat_type in ('motorized_bangka','speedboat','passenger_boat')),capacity integer not null check(capacity between 1 and 200),home_location_id uuid not null references locations,charter_price_minor bigint not null default 0 check(charter_price_minor>=0),seat_price_minor bigint not null default 0 check(seat_price_minor>=0),verification_status text not null default 'draft' check(verification_status in ('draft','submitted','under_review','needs_correction','approved','rejected','suspended','expired')),active boolean not null default false,cancellation_policy text not null default 'Full refund before departure; contact support for weather and safety cancellations.',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.boat_images(id uuid primary key default gen_random_uuid(),boat_id uuid not null references boats,storage_path text not null unique,created_at timestamptz not null default now());
create table public.document_requirements(id uuid primary key default gen_random_uuid(),name text not null,boat_type text,location_id uuid references locations,required boolean not null default true);
create table public.boat_documents(id uuid primary key default gen_random_uuid(),boat_id uuid not null references boats,requirement_id uuid not null references document_requirements,storage_path text not null unique,expires_on date,created_at timestamptz not null default now());
create table public.boat_schedules(id uuid primary key default gen_random_uuid(),boat_id uuid not null references boats,route_id uuid not null references routes,mode text not null check(mode in ('seat','charter')),starts_at timestamptz not null,ends_at timestamptz not null,time_zone text not null default 'Asia/Manila' check(time_zone='Asia/Manila'),capacity integer not null check(capacity between 1 and 200),price_minor bigint not null check(price_minor>0),status text not null default 'open' check(status in ('open','closed','cancelled')),created_at timestamptz not null default now(),check(ends_at>starts_at));
create table public.commission_rules(id uuid primary key default gen_random_uuid(),rate_bps integer not null check(rate_bps between 0 and 10000),service_fee_minor bigint not null default 0 check(service_fee_minor>=0),effective_at timestamptz not null default now(),created_at timestamptz not null default now());
create table public.bookings(id uuid primary key default gen_random_uuid(),reference text not null unique default ('BG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),passenger_id uuid not null references profiles,boat_id uuid not null references boats,schedule_id uuid not null references boat_schedules,mode text not null check(mode in ('seat','charter')),passenger_count integer not null check(passenger_count>0),base_minor bigint not null check(base_minor>0),service_fee_minor bigint not null check(service_fee_minor>=0),total_minor bigint not null check(total_minor=base_minor+service_fee_minor),currency text not null default 'PHP' check(currency='PHP'),commission_rule_id uuid not null references commission_rules,rate_bps integer not null check(rate_bps between 0 and 10000),commission_minor bigint not null,operator_minor bigint not null,policy_accepted_at timestamptz not null default now(),status text not null default 'pending_owner_confirmation' check(status in ('pending_owner_confirmation','awaiting_payment','confirmed','completed','rejected','cancelled','expired','refund_pending','refunded')),reservation_expires_at timestamptz not null,idempotency_key uuid not null,instructions text not null default '' check(length(instructions)<=500),cancellation_reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(passenger_id,idempotency_key));
create table public.payments(id uuid primary key default gen_random_uuid(),booking_id uuid not null unique references bookings,provider text not null default 'paymongo',provider_checkout_id text unique,provider_payment_id text unique,checkout_url text,amount_minor bigint not null check(amount_minor>0),currency text not null default 'PHP' check(currency='PHP'),status text not null default 'creating' check(status in ('creating','pending','paid','failed','expired','refunded')),idempotency_key uuid not null unique default gen_random_uuid(),verified_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.payment_webhook_events(id text primary key,payment_id uuid not null references payments,event_type text not null,created_at timestamptz not null default now());
create table public.platform_commissions(id uuid primary key default gen_random_uuid(),booking_id uuid not null unique references bookings,rate_bps integer not null,commission_minor bigint not null,service_fee_minor bigint not null,processing_fee_minor bigint,adjustment_minor bigint not null default 0,operator_minor bigint not null,reconciliation_status text not null default 'unsettled' check(reconciliation_status in ('unsettled','reconciled','reversed')),created_at timestamptz not null default now());
create table public.refunds(id uuid primary key default gen_random_uuid(),booking_id uuid not null unique references bookings,payment_id uuid not null references payments,amount_minor bigint not null check(amount_minor>0),reason text not null,status text not null default 'requested' check(status in ('requested','processing','confirmed','failed')),provider_reference text unique,created_at timestamptz not null default now());
create table public.payouts(id uuid primary key default gen_random_uuid(),owner_id uuid not null references boat_owners,booking_id uuid not null unique references bookings,amount_minor bigint not null check(amount_minor>=0),status text not null default 'pending' check(status in ('pending','settled')),bank_reference text unique,settled_at timestamptz,created_at timestamptz not null default now());
create table public.reviews(id uuid primary key default gen_random_uuid(),booking_id uuid not null unique references bookings,passenger_id uuid not null references profiles,boat_id uuid not null references boats,rating integer not null check(rating between 1 and 5),body text not null check(length(body)<=1000),created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,title text not null,body text not null,read_at timestamptz,created_at timestamptz not null default now());
create table public.support_tickets(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,booking_id uuid references bookings,subject text not null check(length(subject) between 3 and 150),body text not null check(length(body) between 5 and 3000),status text not null default 'open' check(status in ('open','investigating','resolved')),created_at timestamptz not null default now());
create table public.admin_audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references profiles,action text not null,target_id uuid,reason text,summary jsonb not null default '{}',created_at timestamptz not null default now());
create table public.app_settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
create table public.saved_boats(user_id uuid not null references profiles,boat_id uuid not null references boats,primary key(user_id,boat_id));
create index boats_owner_idx on boats(owner_id);
create index schedules_search_idx on boat_schedules(starts_at,route_id,status);
create index schedules_boat_idx on boat_schedules(boat_id);
create index bookings_schedule_idx on bookings(schedule_id,status,reservation_expires_at);
create index bookings_passenger_idx on bookings(passenger_id,created_at desc);
create index bookings_boat_idx on bookings(boat_id);
create index documents_boat_idx on boat_documents(boat_id);
create index notifications_user_idx on notifications(user_id,created_at desc);

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and account_status='active') $$;
create function private.is_active() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and account_status='active') $$;
create function private.owns_boat(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.boats b join public.profiles p on p.id=b.owner_id where b.id=p_id and p.id=auth.uid() and p.account_status='active')$$;
create function private.visible_boat(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.boats b join public.boat_owners o on o.id=b.owner_id join public.profiles p on p.id=o.id where b.id=p_id and b.verification_status='approved' and b.active and o.verification_status='approved' and p.account_status='active' and not exists(select 1 from public.document_requirements r where r.required and (r.boat_type is null or r.boat_type=b.boat_type) and (r.location_id is null or r.location_id=b.home_location_id) and not exists(select 1 from public.boat_documents d where d.boat_id=b.id and d.requirement_id=r.id and (d.expires_on is null or d.expires_on>=(now() at time zone 'Asia/Manila')::date))))$$;
create function private.can_read_booking(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.bookings b where b.id=p_id and ((b.passenger_id=auth.uid() and private.is_active()) or private.owns_boat(b.boat_id) or private.is_admin()))$$;
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.profiles(id,display_name,role) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'New traveller'),80),case when new.raw_user_meta_data->>'role'='owner' then 'owner' else 'passenger' end);
 if new.raw_user_meta_data->>'role'='owner' then insert into public.boat_owners(id) values(new.id);end if;return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_user();

do $$declare t text;begin
 foreach t in array array['profiles','boat_owners','locations','routes','boats','boat_images','document_requirements','boat_documents','boat_schedules','commission_rules','bookings','payments','payment_webhook_events','platform_commissions','refunds','payouts','reviews','notifications','support_tickets','admin_audit_logs','app_settings','saved_boats'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using (private.is_admin())',t);
 end loop;end$$;
create policy self on profiles for select to authenticated using(id=auth.uid() and private.is_active());
grant update(display_name,phone,push_token,notifications_enabled) on profiles to authenticated;
create policy self_update on profiles for update to authenticated using(id=auth.uid() and private.is_active()) with check(id=auth.uid() and private.is_active());
create policy self on boat_owners for select to authenticated using(id=auth.uid() and private.is_active());
grant select on locations,routes,document_requirements,boats,boat_images,boat_schedules,reviews to anon;
create policy public_read on locations for select using(active);
create policy public_read on routes for select using(active);
create policy public_read on document_requirements for select using(true);
create policy public_read on boats for select using(private.visible_boat(id));
create policy owner_read on boats for select to authenticated using(private.owns_boat(id));
create policy public_read on boat_images for select using(private.visible_boat(boat_id));
create policy owner_read on boat_images for select to authenticated using(private.owns_boat(boat_id));
create policy owner_read on boat_documents for select to authenticated using(private.owns_boat(boat_id));
create policy public_read on boat_schedules for select using(private.visible_boat(boat_id) and status='open');
create policy owner_read on boat_schedules for select to authenticated using(private.owns_boat(boat_id));
create policy related on bookings for select to authenticated using(private.can_read_booking(id));
create policy related on payments for select to authenticated using(private.can_read_booking(booking_id));
create policy related on platform_commissions for select to authenticated using(exists(select 1 from bookings b where b.id=booking_id and private.owns_boat(b.boat_id)));
create policy related on refunds for select to authenticated using(private.can_read_booking(booking_id));
create policy self on payouts for select to authenticated using(owner_id=auth.uid() and private.is_active());
create policy public_read on reviews for select using(private.visible_boat(boat_id));
create policy self on notifications for select to authenticated using(user_id=auth.uid() and private.is_active());
grant update(read_at) on notifications to authenticated;
create policy self_update on notifications for update to authenticated using(user_id=auth.uid() and private.is_active()) with check(user_id=auth.uid() and private.is_active());
create policy self on support_tickets for select to authenticated using(user_id=auth.uid() and private.is_active());
grant insert(user_id,booking_id,subject,body) on support_tickets to authenticated;
create policy self_insert on support_tickets for insert to authenticated with check(user_id=auth.uid() and private.is_active() and (booking_id is null or private.can_read_booking(booking_id)));
grant select,insert,delete on saved_boats to authenticated;
create policy self on saved_boats for all to authenticated using(user_id=auth.uid() and private.is_active()) with check(user_id=auth.uid() and private.is_active() and private.visible_boat(boat_id));
grant insert(booking_id,passenger_id,boat_id,rating,body) on reviews to authenticated;
create policy eligible_review on reviews for insert to authenticated with check(passenger_id=auth.uid() and private.is_active() and exists(select 1 from bookings b where b.id=booking_id and b.passenger_id=auth.uid() and b.boat_id=reviews.boat_id and b.status='completed'));

create function private.save_boat(p_data jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$declare v_id uuid;begin
 if not exists(select 1 from public.boat_owners o join public.profiles p on p.id=o.id where o.id=auth.uid() and p.account_status='active' and o.verification_status<>'suspended') then raise exception 'Active owner account required';end if;
 if p_id is not null and not private.owns_boat(p_id) then raise exception 'Not your boat';end if;
 if p_id is not null and exists(select 1 from public.boat_schedules where boat_id=p_id and ends_at>now() and status<>'cancelled') then raise exception 'Close future schedules before changing registration details';end if;
 insert into public.boats(id,owner_id,name,description,boat_type,capacity,home_location_id,charter_price_minor,seat_price_minor)
 values(coalesce(p_id,gen_random_uuid()),auth.uid(),p_data->>'name',p_data->>'description',p_data->>'boat_type',(p_data->>'capacity')::int,(p_data->>'home_location_id')::uuid,(p_data->>'charter_price_minor')::bigint,(p_data->>'seat_price_minor')::bigint)
 on conflict(id) do update set name=excluded.name,description=excluded.description,boat_type=excluded.boat_type,capacity=excluded.capacity,home_location_id=excluded.home_location_id,charter_price_minor=excluded.charter_price_minor,seat_price_minor=excluded.seat_price_minor,verification_status='draft',active=false,updated_at=now() returning id into v_id;return v_id;end$$;
create function private.submit_boat(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not private.owns_boat(p_id) then raise exception 'Not your boat';end if;
 if exists(select 1 from public.document_requirements r join public.boats b on b.id=p_id where r.required and (r.boat_type is null or r.boat_type=b.boat_type) and (r.location_id is null or r.location_id=b.home_location_id) and not exists(select 1 from public.boat_documents d where d.boat_id=p_id and d.requirement_id=r.id and (d.expires_on is null or d.expires_on>=(now() at time zone 'Asia/Manila')::date))) then raise exception 'Upload all current required documents';end if;
 update public.boats set verification_status='submitted',active=false where id=p_id and verification_status in ('draft','needs_correction','rejected');if not found then raise exception 'Registration cannot be submitted in this state';end if;
 insert into public.notifications(user_id,title,body) values(auth.uid(),'Registration submitted','Your boat is awaiting administrator review.');
 insert into public.notifications(user_id,title,body) select id,'Boat registration awaiting review',p_id::text from public.profiles where role='admin' and account_status='active';end$$;
create function private.add_attachment(p_boat uuid,p_path text,p_requirement uuid default null,p_expires date default null) returns void language plpgsql security definer set search_path='' as $$begin
 if not private.owns_boat(p_boat) or split_part(p_path,'/',1)<>auth.uid()::text then raise exception 'Attachment access denied';end if;
 if not exists(select 1 from public.boats where id=p_boat and verification_status in ('draft','needs_correction','rejected')) then raise exception 'Only draft or correction registrations accept uploads';end if;
 if not exists(select 1 from storage.objects where bucket_id=case when p_requirement is null then 'boat-photos' else 'boat-documents' end and name=p_path and owner_id=auth.uid()::text) then raise exception 'Upload file first';end if;
 if p_requirement is null then insert into public.boat_images(boat_id,storage_path) values(p_boat,p_path);else insert into public.boat_documents(boat_id,requirement_id,storage_path,expires_on) values(p_boat,p_requirement,p_path,p_expires);end if;end$$;
create function private.review_boat(p_id uuid,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$declare b public.boats;begin
 if not private.is_admin() then raise exception 'Administrator required';end if;
 if p_status not in ('approved','rejected','needs_correction','suspended','under_review') or length(trim(p_reason))<5 then raise exception 'Valid decision and reason required';end if;
 select * into b from public.boats where id=p_id for update;if not found then raise exception 'Boat not found';end if;
 if b.owner_id=auth.uid() then raise exception 'Cannot review your own boat';end if;
 if p_status='approved' and exists(select 1 from public.document_requirements r where r.required and (r.boat_type is null or r.boat_type=b.boat_type) and (r.location_id is null or r.location_id=b.home_location_id) and not exists(select 1 from public.boat_documents d where d.boat_id=b.id and d.requirement_id=r.id and (d.expires_on is null or d.expires_on>=(now() at time zone 'Asia/Manila')::date))) then raise exception 'Missing or expired documents';end if;
 update public.boats set verification_status=p_status,active=(p_status='approved'),updated_at=now() where id=p_id;
 if p_status='approved' then update public.boat_owners set verification_status='approved' where id=b.owner_id;end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,reason,summary) values(auth.uid(),'boat.'||p_status,p_id,p_reason,jsonb_build_object('before',b.verification_status));
 insert into public.notifications(user_id,title,body) values(b.owner_id,'Boat registration: '||p_status,p_reason);end$$;
create function private.save_schedule(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare b public.boats;s public.boat_schedules;v_id uuid;begin
 select * into b from public.boats where id=(p_data->>'boat_id')::uuid for update;
 if not private.owns_boat(b.id) or not private.visible_boat(b.id) then raise exception 'Approved active boat required';end if;
 s.starts_at:=(p_data->>'starts_at')::timestamptz;s.ends_at:=(p_data->>'ends_at')::timestamptz;s.mode:=p_data->>'mode';s.capacity:=(p_data->>'capacity')::int;
 if s.starts_at<=now() or s.ends_at<=s.starts_at or s.capacity>b.capacity then raise exception 'Invalid schedule or capacity';end if;
 if not exists(select 1 from public.routes where id=(p_data->>'route_id')::uuid and active) then raise exception 'Active route required';end if;
 if (s.mode='seat' and b.seat_price_minor<=0) or (s.mode='charter' and b.charter_price_minor<=0) then raise exception 'Booking mode not enabled on boat';end if;
 if exists(select 1 from public.boat_schedules x where x.boat_id=b.id and x.status<>'cancelled' and tstzrange(x.starts_at,x.ends_at,'[)') && tstzrange(s.starts_at,s.ends_at,'[)')) then raise exception 'Schedule overlaps an existing trip';end if;
 insert into public.boat_schedules(boat_id,route_id,starts_at,ends_at,mode,capacity,price_minor) values(b.id,(p_data->>'route_id')::uuid,s.starts_at,s.ends_at,s.mode,s.capacity,(p_data->>'price_minor')::bigint) returning id into v_id;return v_id;end$$;
create function private.reserve_booking(p_schedule uuid,p_count int,p_key uuid,p_instructions text default '') returns public.bookings language plpgsql security definer set search_path='' as $$declare s public.boat_schedules;b public.boats;r public.commission_rules;v public.bookings;v_used int;v_base bigint;v_comm bigint;begin
 if not private.is_active() then raise exception 'Active signed-in account required';end if;
 -- Serialize retries for the same passenger/key before acquiring the boat lock.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select * into v from public.bookings where passenger_id=auth.uid() and idempotency_key=p_key;
 if found then if v.schedule_id<>p_schedule or v.passenger_count<>p_count then raise exception 'Idempotency key reused with different request';end if;return v;end if;
 select * into s from public.boat_schedules where id=p_schedule;if not found then raise exception 'Schedule not found';end if;
 select * into b from public.boats where id=s.boat_id for update;
 select * into s from public.boat_schedules where id=p_schedule for update;
 if b.owner_id=auth.uid() or not private.visible_boat(b.id) or s.status<>'open' or s.starts_at<=now() or p_count<1 or p_count>s.capacity then raise exception 'Boat unavailable or passenger count invalid';end if;
 update public.bookings set status='expired',updated_at=now() where schedule_id=s.id and status in ('pending_owner_confirmation','awaiting_payment') and reservation_expires_at<=now();
 select coalesce(sum(case when mode='charter' then s.capacity else passenger_count end),0) into v_used from public.bookings where schedule_id=s.id and (status in ('confirmed','completed') or (status in ('pending_owner_confirmation','awaiting_payment') and reservation_expires_at>now()));
 if (s.mode='charter' and v_used>0) or (s.mode='seat' and v_used+p_count>s.capacity) then raise exception 'Insufficient available capacity';end if;
 select * into r from public.commission_rules where effective_at<=now() order by effective_at desc limit 1;if not found then raise exception 'Commission configuration required';end if;
 v_base:=s.price_minor*case when s.mode='seat' then p_count else 1 end;v_comm:=round(v_base::numeric*r.rate_bps/10000)::bigint;
 insert into public.bookings(passenger_id,boat_id,schedule_id,mode,passenger_count,base_minor,service_fee_minor,total_minor,commission_rule_id,rate_bps,commission_minor,operator_minor,reservation_expires_at,idempotency_key,instructions)
 values(auth.uid(),b.id,s.id,s.mode,p_count,v_base,r.service_fee_minor,v_base+r.service_fee_minor,r.id,r.rate_bps,v_comm,v_base-v_comm,least(now()+interval '30 minutes',s.starts_at),p_key,p_instructions) returning * into v;
 insert into public.notifications(user_id,title,body) values(b.owner_id,'New booking request',v.reference||' is awaiting your decision.');return v;end$$;
create function private.booking_action(p_id uuid,p_action text,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$declare b public.bookings;s public.boat_schedules;v_owner boolean;begin
 select x.* into b from public.bookings x where x.id=p_id;if not found then raise exception 'Booking not found';end if;
 perform 1 from public.boats where id=b.boat_id for update;
 select * into b from public.bookings where id=p_id for update;
 select * into s from public.boat_schedules where id=b.schedule_id;
 v_owner:=private.owns_boat(b.boat_id);
 if not private.can_read_booking(b.id) then raise exception 'Booking access denied';end if;
 if p_action in ('accept','reject') then
  if p_action='accept' and not private.visible_boat(b.boat_id) then raise exception 'Boat no longer eligible for booking acceptance';end if;
  if not v_owner or b.status<>'pending_owner_confirmation' or b.reservation_expires_at<=now() then raise exception 'Request no longer eligible';end if;
  update public.bookings set status=case when p_action='accept' then 'awaiting_payment' else 'rejected' end,updated_at=now() where id=p_id;
 elsif p_action='cancel' then
  if length(trim(p_reason))<5 or b.status not in ('pending_owner_confirmation','awaiting_payment','confirmed') or s.starts_at<=now() then raise exception 'Cancellation not permitted; contact support';end if;
  if b.status='confirmed' then
   if exists(select 1 from public.payouts where booking_id=b.id and status='settled') then raise exception 'Settled booking requires finance investigation';end if;
   update public.bookings set status='refund_pending',cancellation_reason=p_reason,updated_at=now() where id=p_id;
   insert into public.refunds(booking_id,payment_id,amount_minor,reason) select b.id,p.id,p.amount_minor,p_reason from public.payments p where p.booking_id=b.id and p.status='paid' on conflict(booking_id) do nothing;
  else update public.bookings set status='cancelled',cancellation_reason=p_reason,updated_at=now() where id=p_id;end if;
 elsif p_action='complete' then
  if not v_owner or b.status<>'confirmed' or s.ends_at>now() then raise exception 'Trip cannot be completed yet';end if;
  update public.bookings set status='completed',updated_at=now() where id=p_id;
  insert into public.payouts(owner_id,booking_id,amount_minor) select owner_id,b.id,coalesce((select c.operator_minor from public.platform_commissions c where c.booking_id=b.id),b.operator_minor) from public.boats where id=b.boat_id on conflict(booking_id) do nothing;
 else raise exception 'Unsupported action';end if;
 insert into public.notifications(user_id,title,body) values(b.passenger_id,'Booking updated',b.reference||': '||p_action);
 if private.is_admin() then insert into public.admin_audit_logs(actor_id,action,target_id,reason) values(auth.uid(),'booking.'||p_action,b.id,p_reason);end if;end$$;

-- Only service_role can invoke the payment mutation entrypoints.
create function private.prepare_checkout(p_user uuid,p_booking uuid) returns public.payments language plpgsql security definer set search_path='' as $$declare b public.bookings;p public.payments;begin
 select * into b from public.bookings where id=p_booking for update;
 if not exists(select 1 from public.profiles where id=p_user and account_status='active') or b.passenger_id<>p_user or b.status<>'awaiting_payment' or b.reservation_expires_at<=now() or not private.visible_boat(b.boat_id) then raise exception 'Booking is not eligible for payment';end if;
 insert into public.payments(booking_id,amount_minor) values(b.id,b.total_minor) on conflict(booking_id) do nothing;
 select * into p from public.payments where booking_id=b.id;return p;end$$;
create function private.verify_payment(p_event text,p_checkout text,p_provider_payment text,p_amount bigint,p_currency text) returns text language plpgsql security definer set search_path='' as $$declare p public.payments;b public.bookings;v_late boolean;begin
 select * into p from public.payments where provider_checkout_id=p_checkout;if not found then raise exception 'Unknown checkout';end if;
 select * into b from public.bookings where id=p.booking_id;
 perform 1 from public.boats where id=b.boat_id for update;
 select * into b from public.bookings where id=p.booking_id for update;
 select * into p from public.payments where id=p.id for update;
 if p_amount<>p.amount_minor or p_currency<>p.currency or length(p_provider_payment)<3 then raise exception 'Payment verification mismatch';end if;
 insert into public.payment_webhook_events(id,payment_id,event_type) values(p_event,p.id,'checkout_session.payment.paid') on conflict(id) do nothing;if not found then return 'duplicate';end if;
 if p.status in ('paid','refunded') then return 'duplicate';end if;
 update public.payments set status='paid',provider_payment_id=p_provider_payment,verified_at=now(),updated_at=now() where id=p.id;
 v_late:=b.status<>'awaiting_payment' or b.reservation_expires_at<=now() or not private.visible_boat(b.boat_id);
 if v_late then
  update public.bookings set status='refund_pending',updated_at=now() where id=b.id;
  insert into public.refunds(booking_id,payment_id,amount_minor,reason) values(b.id,p.id,p.amount_minor,'Payment received after reservation eligibility ended') on conflict(booking_id) do nothing;
 else
  update public.bookings set status='confirmed',updated_at=now() where id=b.id;
  insert into public.platform_commissions(booking_id,rate_bps,commission_minor,service_fee_minor,operator_minor) values(b.id,b.rate_bps,b.commission_minor,b.service_fee_minor,b.operator_minor) on conflict(booking_id) do nothing;
 end if;
 insert into public.notifications(user_id,title,body) values(b.passenger_id,case when v_late then 'Payment received; refund required' else 'Payment verified' end,b.reference);
 insert into public.notifications(user_id,title,body) select owner_id,case when v_late then 'Payment received; refund required' else 'Booking payment verified' end,b.reference from public.boats where id=b.boat_id;
 return case when v_late then 'refund_pending' else 'confirmed' end;end$$;
create function private.admin_action(p_action text,p_id uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$declare v_ref text;begin
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
 elsif p_action='support_resolve' then update public.support_tickets set status='resolved' where id=p_id;
 else raise exception 'Unsupported administrative action';end if;
 insert into public.admin_audit_logs(actor_id,action,target_id,reason,summary) values(auth.uid(),p_action,p_id,p_data->>'reason',p_data-'reason');end$$;

-- Invoker wrappers expose only explicitly reviewed operations to PostgREST.
create function public.save_boat(p_data jsonb,p_id uuid default null) returns uuid language sql security invoker set search_path='' as $$select private.save_boat(p_data,p_id)$$;
create function public.submit_boat(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.submit_boat(p_id)$$;
create function public.add_attachment(p_boat uuid,p_path text,p_requirement uuid default null,p_expires date default null) returns void language sql security invoker set search_path='' as $$select private.add_attachment(p_boat,p_path,p_requirement,p_expires)$$;
create function public.review_boat(p_id uuid,p_status text,p_reason text) returns void language sql security invoker set search_path='' as $$select private.review_boat(p_id,p_status,p_reason)$$;
create function public.save_schedule(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select private.save_schedule(p_data)$$;
create function public.reserve_booking(p_schedule uuid,p_count int,p_key uuid,p_instructions text default '') returns public.bookings language sql security invoker set search_path='' as $$select private.reserve_booking(p_schedule,p_count,p_key,p_instructions)$$;
create function public.booking_action(p_id uuid,p_action text,p_reason text default '') returns void language sql security invoker set search_path='' as $$select private.booking_action(p_id,p_action,p_reason)$$;
create function public.admin_action(p_action text,p_id uuid,p_data jsonb) returns void language sql security invoker set search_path='' as $$select private.admin_action(p_action,p_id,p_data)$$;
create function public.prepare_checkout(p_user uuid,p_booking uuid) returns public.payments language sql security invoker set search_path='' as $$select private.prepare_checkout(p_user,p_booking)$$;
create function public.verify_payment(p_event text,p_checkout text,p_provider_payment text,p_amount bigint,p_currency text) returns text language sql security invoker set search_path='' as $$select private.verify_payment(p_event,p_checkout,p_provider_payment,p_amount,p_currency)$$;
create function public.available_schedules() returns table(id uuid,boat_id uuid,boat_name text,boat_type text,description text,capacity int,mode text,price_minor bigint,starts_at timestamptz,ends_at timestamptz,origin text,destination text,remaining int,photo_path text,owner_name text,cancellation_policy text) language sql stable security definer set search_path='' as $$
 select s.id,b.id,b.name,b.boat_type,b.description,s.capacity,s.mode,s.price_minor,s.starts_at,s.ends_at,o.name,d.name,
 greatest(0,s.capacity-coalesce((select sum(case when x.mode='charter' then s.capacity else x.passenger_count end)::int from public.bookings x where x.schedule_id=s.id and (x.status in ('confirmed','completed') or (x.status in ('pending_owner_confirmation','awaiting_payment') and x.reservation_expires_at>now()))),0)),
 (select i.storage_path from public.boat_images i where i.boat_id=b.id order by i.created_at limit 1),p.display_name,b.cancellation_policy
 from public.boat_schedules s join public.boats b on b.id=s.boat_id join public.profiles p on p.id=b.owner_id join public.routes r on r.id=s.route_id join public.locations o on o.id=r.origin_id join public.locations d on d.id=r.destination_id
 where private.visible_boat(b.id) and s.status='open' and s.starts_at>now() and r.active and o.active and d.active $$;
create function public.booking_contact(p_id uuid) returns table(display_name text,phone text) language sql stable security definer set search_path='' as $$select p.display_name,p.phone from public.bookings b join public.boats t on t.id=b.boat_id join public.profiles p on p.id=case when b.passenger_id=auth.uid() then t.owner_id else b.passenger_id end where b.id=p_id and private.can_read_booking(b.id) and b.status in ('awaiting_payment','confirmed','completed')$$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function private.is_admin(),private.is_active(),private.owns_boat(uuid),private.can_read_booking(uuid) to authenticated;
grant execute on function private.visible_boat(uuid) to anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.save_boat(jsonb,uuid),private.submit_boat(uuid),private.add_attachment(uuid,text,uuid,date),private.review_boat(uuid,text,text),private.save_schedule(jsonb),private.reserve_booking(uuid,int,uuid,text),private.booking_action(uuid,text,text),private.admin_action(text,uuid,jsonb) to authenticated;
grant execute on function public.save_boat(jsonb,uuid),public.submit_boat(uuid),public.add_attachment(uuid,text,uuid,date),public.review_boat(uuid,text,text),public.save_schedule(jsonb),public.reserve_booking(uuid,int,uuid,text),public.booking_action(uuid,text,text),public.admin_action(text,uuid,jsonb),public.booking_contact(uuid) to authenticated;
grant execute on function public.available_schedules() to anon,authenticated;
grant execute on function private.prepare_checkout(uuid,uuid),private.verify_payment(text,text,text,bigint,text),public.prepare_checkout(uuid,uuid),public.verify_payment(text,text,text,bigint,text) to service_role;
grant all on all tables in schema public to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('boat-documents','boat-documents',false,10485760,array['application/pdf','image/jpeg','image/png']),('boat-photos','boat-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy owner_upload on storage.objects for insert to authenticated with check(bucket_id in ('boat-documents','boat-photos') and (storage.foldername(name))[1]=auth.uid()::text and private.is_active() and exists(select 1 from public.boat_owners where id=auth.uid()));
create policy owner_or_admin_read on storage.objects for select to authenticated using(bucket_id in ('boat-documents','boat-photos') and (((storage.foldername(name))[1]=auth.uid()::text and private.is_active()) or private.is_admin()));
create policy approved_photo_read on storage.objects for select to anon,authenticated using(bucket_id='boat-photos' and exists(select 1 from public.boat_images i where i.storage_path=name and private.visible_boat(i.boat_id)));


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
