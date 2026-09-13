begin;
select plan(5);

select has_table('public', 'clinical_records', 'clinical records table exists');
select col_is_fk('public', 'clinical_records', 'created_by', 'created_by references veterinarian');
select col_not_null('public', 'clinical_records', 'created_by', 'created_by is mandatory');
select has_function('public', 'deny_attribution_mutation', ARRAY[]::text[], 'attribution trigger exists');
select has_function('public', 'guard_approved_clinical_record', ARRAY[]::text[], 'approval guard exists');

select * from finish();
rollback;
