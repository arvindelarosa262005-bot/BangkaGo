-- DEMO geography only. No fabricated boats, ratings, availability, payments or users.
insert into public.locations(id,name,municipality) values
 ('10000000-0000-4000-8000-000000000001','Abra de Ilog Port','Abra de Ilog'),
 ('10000000-0000-4000-8000-000000000002','Wawa','Abra de Ilog'),
 ('10000000-0000-4000-8000-000000000003','Mamburao','Mamburao');
insert into public.routes(origin_id,destination_id) select a.id,b.id from public.locations a cross join public.locations b where a.id<>b.id;
insert into public.commission_rules(rate_bps,service_fee_minor) values(1000,0);
insert into public.document_requirements(name) values('Vessel registration'),('Applicable operating permit'),('Safety inspection / certification');
insert into public.app_settings(key,value) values('platform_name','"BangkaGo"'),('document_notice','"Development requirements only. Confirm required permits and safety documents with the relevant authorities before pilot operations."'),('cancellation_policy','"Full refund before departure; contact support for weather and safety cancellations."');
