-- ============================================================================
-- Account management
--
-- Accounts are created by an admin, never by self-signup. Rather than run a
-- server with the secret key in it, account creation is a SECURITY DEFINER
-- function called over RPC with the caller's own JWT. The secret key then
-- never has to exist anywhere — not in the browser, not in an edge function,
-- not in Vercel's environment.
--
-- Authorisation is explicit inside each function:
--   * an admin may do anything
--   * the dashboard SQL editor (postgres) may do anything, so you can always
--     recover access or bootstrap the very first admin
--   * everyone else is refused
-- ============================================================================

create or replace function public.assert_can_manage_users()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- current_user is 'postgres' in the dashboard SQL editor and during
  -- migrations; auth.uid() is null there, which is why this check comes first.
  if current_user in ('postgres', 'supabase_admin') then
    return;
  end if;

  if public.is_admin() then
    return;
  end if;

  raise exception 'Only an admin can manage accounts'
    using errcode = 'insufficient_privilege';
end;
$$;

-- ---------------------------------------------------------------------------
-- Create an account. Returns the new profile id.
--
--   select create_app_user('NITIN', 'Nitin Kulkarni', 'choose-a-password', 'admin');
-- ---------------------------------------------------------------------------
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
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    mail, extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false
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

-- ---------------------------------------------------------------------------
-- Reset someone's password. Admins can reset anyone; anyone can reset their
-- own (that path is also covered by supabase.auth.updateUser).
-- ---------------------------------------------------------------------------
create or replace function public.set_app_user_password(
  p_user_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id <> auth.uid() then
    perform public.assert_can_manage_users();
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'No such user';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deactivate / reactivate. We never delete people — their name is attached to
-- ledger history that has to stay readable.
-- ---------------------------------------------------------------------------
create or replace function public.set_app_user_active(
  p_user_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_can_manage_users();

  if p_user_id = auth.uid() and not p_active then
    raise exception 'You cannot deactivate your own account';
  end if;

  update public.profiles set active = p_active where id = p_user_id;

  if not found then
    raise exception 'No such user';
  end if;
end;
$$;

create or replace function public.set_app_user_role(
  p_user_id uuid,
  p_role user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_can_manage_users();

  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  if not found then
    raise exception 'No such user';
  end if;
end;
$$;

-- Only signed-in users may even attempt these; the functions then decide.
revoke all on function public.create_app_user(text, text, text, user_role, text) from public, anon;
revoke all on function public.set_app_user_password(uuid, text) from public, anon;
revoke all on function public.set_app_user_active(uuid, boolean) from public, anon;
revoke all on function public.set_app_user_role(uuid, user_role) from public, anon;

grant execute on function public.create_app_user(text, text, text, user_role, text) to authenticated;
grant execute on function public.set_app_user_password(uuid, text) to authenticated;
grant execute on function public.set_app_user_active(uuid, boolean) to authenticated;
grant execute on function public.set_app_user_role(uuid, user_role) to authenticated;
