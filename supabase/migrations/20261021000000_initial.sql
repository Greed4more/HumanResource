create type public.app_role as enum ('admin','moderator','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  birthdate date,
  gender text,
  interested_in text,
  course text,
  year text,
  bio text,
  interests text[] not null default '{}',
  photo_path text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.verifications (
  user_id uuid primary key,
  id_card_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant select, insert, update on public.verifications to authenticated;
grant all on public.verifications to service_role;
alter table public.verifications enable row level security;

create or replace function public.is_approved(_uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    join public.verifications v on v.user_id = p.id
    where p.id = _uid and p.onboarded and v.status = 'approved'
      and p.birthdate is not null and p.birthdate <= (current_date - interval '18 years')
      and lower(p.email) like '%@stu.adamasuniversity.ac.in'
  )
$$;

create table public.blocks (
  blocker uuid not null,
  blocked uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
alter table public.blocks enable row level security;
create policy "own blocks" on public.blocks for all to authenticated using (blocker = auth.uid()) with check (blocker = auth.uid());

create or replace function public.is_blocked_between(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.blocks where (blocker=_a and blocked=_b) or (blocker=_b and blocked=_a)) $$;

-- profiles policies
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "approved see approved" on public.profiles for select to authenticated
  using (public.is_approved(auth.uid()) and public.is_approved(id) and not public.is_blocked_between(auth.uid(), id));
create policy "admin reads profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- verification policies
create policy "own verification read" on public.verifications for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own verification insert" on public.verifications for insert to authenticated with check (user_id = auth.uid());
create policy "own or admin verification update" on public.verifications for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.guard_verification()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(),'admin') then
    new.status := 'pending';
    new.note := null;
    new.reviewed_at := null;
    new.submitted_at := now();
  else
    if tg_op = 'UPDATE' and new.status <> old.status then new.reviewed_at := now(); end if;
  end if;
  return new;
end $$;
create trigger guard_verification before insert or update on public.verifications for each row execute function public.guard_verification();

-- profile guards: email immutable, adult check
create or replace function public.guard_profile()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.email := old.email;
  if new.birthdate is not null and new.birthdate > (current_date - interval '18 years') then
    raise exception 'You must be 18 or older to join';
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();

-- signup trigger: only student emails
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if lower(new.email) not like '%@stu.adamasuniversity.ac.in' then
    raise exception 'Only @stu.adamasuniversity.ac.in email addresses can join';
  end if;
  insert into public.profiles (id, email) values (new.id, lower(new.email));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- swipes
create table public.swipes (
  swiper uuid not null,
  target uuid not null,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (swiper, target)
);
grant select, insert on public.swipes to authenticated;
grant all on public.swipes to service_role;
alter table public.swipes enable row level security;
create policy "read own swipes" on public.swipes for select to authenticated using (swiper = auth.uid());
create policy "approved swipe" on public.swipes for insert to authenticated
  with check (swiper = auth.uid() and target <> auth.uid() and public.is_approved(auth.uid()) and public.is_approved(target) and not public.is_blocked_between(auth.uid(), target));

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null,
  user_b uuid not null,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
grant select, delete on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "participants read" on public.matches for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "participants unmatch" on public.matches for delete to authenticated using (auth.uid() in (user_a, user_b));

create or replace function public.create_match_on_like()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.liked and exists (select 1 from public.swipes where swiper = new.target and target = new.swiper and liked) then
    insert into public.matches (user_a, user_b) values (least(new.swiper,new.target), greatest(new.swiper,new.target)) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_swipe after insert on public.swipes for each row execute function public.create_match_on_like();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "participants read messages" on public.messages for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b)));
create policy "participants send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (
    select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b)
      and not public.is_blocked_between(m.user_a, m.user_b)));
alter publication supabase_realtime add table public.messages;

-- blocking removes match
create or replace function public.unmatch_on_block()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  delete from public.matches where user_a = least(new.blocker,new.blocked) and user_b = greatest(new.blocker,new.blocked);
  return new; end $$;
create trigger on_block after insert on public.blocks for each row execute function public.unmatch_on_block();

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null,
  reported uuid not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "file report" on public.reports for insert to authenticated with check (reporter = auth.uid() and status = 'open');
create policy "admin reads reports" on public.reports for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin updates reports" on public.reports for update to authenticated using (public.has_role(auth.uid(),'admin'));

-- storage policies (buckets are created in the hardening migration)
create policy "own photos write" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos update" on storage.objects for update to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos read" on storage.objects for select to authenticated using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_approved(auth.uid()) or public.has_role(auth.uid(),'admin')));
create policy "own id write" on storage.objects for insert to authenticated with check (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own id update" on storage.objects for update to authenticated using (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "id read" on storage.objects for select to authenticated using (bucket_id = 'id-cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));
