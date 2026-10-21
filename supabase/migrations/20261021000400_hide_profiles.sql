-- Admin-only visibility flag for test accounts. Hidden profiles stay usable by
-- their owner and visible to admins, but disappear for every other student.

alter table public.profiles add column if not exists hidden_at timestamptz;
grant select (hidden_at) on public.profiles to authenticated;

drop policy if exists "approved see approved" on public.profiles;
create policy "approved see approved" on public.profiles for select to authenticated
  using (
    public.is_approved(auth.uid())
    and public.is_approved(id)
    and hidden_at is null
    and not public.is_blocked_between(auth.uid(), id)
  );

create or replace function public.is_approved_folder(_folder text)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when _folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_approved(_folder::uuid)
        and not exists (
          select 1 from public.profiles p
          where p.id = _folder::uuid and p.hidden_at is not null
        )
    else false
  end
$$;

revoke execute on function public.is_approved_folder(text) from public, anon;
grant execute on function public.is_approved_folder(text) to authenticated, service_role;

create index if not exists profiles_hidden_at_idx
  on public.profiles (hidden_at) where hidden_at is not null;

create or replace function public.admin_set_profile_hidden(_user_id uuid, _hidden boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admins only';
  end if;
  update public.profiles
  set hidden_at = case when _hidden then now() else null end
  where id = _user_id;
end $$;

create or replace function public.admin_hidden_profiles()
returns table (
  user_id uuid,
  display_name text,
  email text,
  hidden_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.display_name, p.email, p.hidden_at
  from public.profiles p
  where p.hidden_at is not null
    and public.has_role(auth.uid(), 'admin')
  order by p.hidden_at desc;
$$;

revoke execute on function public.admin_set_profile_hidden(uuid, boolean) from public, anon;
revoke execute on function public.admin_hidden_profiles() from public, anon;
grant execute on function public.admin_set_profile_hidden(uuid, boolean) to authenticated;
grant execute on function public.admin_hidden_profiles() to authenticated;

notify pgrst, 'reload schema';
