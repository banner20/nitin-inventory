-- ============================================================================
-- Fix: accounts created by create_app_user() could not sign in.
--
-- GoTrue reads auth.users into Go structs where the various token columns are
-- plain strings, not pointers. A row inserted by hand leaves those columns
-- NULL, the scan fails, and every login attempt comes back as
-- `500 Database error querying schema` — which points at the schema rather
-- than at the row, so it is worth spelling out here.
--
-- The columns must be empty strings, not NULL. Supabase's own signup path
-- writes '' for exactly this reason.
-- ============================================================================

create or replace function public.create_app_user(
  p_emp_code text,
  p_full_name text,
  p_password text,
  p_role user_role default 'crew',
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := gen_random_uuid();
  code text := upper(trim(p_emp_code));
  mail text := lower(trim(p_emp_code)) || '@nitin.local';
begin
  perform public.assert_can_manage_users();

  if code !~ '^[A-Za-z0-9_-]{2,32}$' then
    raise exception 'Employee code must be 2-32 letters, digits, _ or -';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Full name is required';
  end if;

  if exists (select 1 from public.profiles where emp_code = code) then
    raise exception 'Employee code % is already taken', code
      using errcode = 'unique_violation';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    -- Empty strings, never NULL. See the note at the top of this file.
    confirmation_token, recovery_token, email_change_token_new,
    email_change, email_change_token_current, phone_change,
    phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    mail, extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid,
    jsonb_build_object('sub', uid::text, 'email', mail),
    'email', uid::text, now(), now(), now()
  );

  insert into public.profiles (id, emp_code, full_name, role, phone)
  values (uid, code, trim(p_full_name), p_role, nullif(trim(coalesce(p_phone, '')), ''));

  return uid;
end;
$$;

-- Repair any account already created with NULLs in those columns.
update auth.users
   set confirmation_token         = coalesce(confirmation_token, ''),
       recovery_token             = coalesce(recovery_token, ''),
       email_change_token_new     = coalesce(email_change_token_new, ''),
       email_change               = coalesce(email_change, ''),
       email_change_token_current = coalesce(email_change_token_current, ''),
       phone_change               = coalesce(phone_change, ''),
       phone_change_token         = coalesce(phone_change_token, ''),
       reauthentication_token     = coalesce(reauthentication_token, '')
 where confirmation_token is null
    or recovery_token is null
    or email_change_token_new is null
    or email_change is null
    or email_change_token_current is null
    or phone_change is null
    or phone_change_token is null
    or reauthentication_token is null;

revoke all on function public.create_app_user(text, text, text, user_role, text) from public, anon;
grant execute on function public.create_app_user(text, text, text, user_role, text) to authenticated;
