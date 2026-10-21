-- Hardening pass: private buckets, privacy, referential integrity, DB caps,
-- server-side discovery/matching helpers, and basic abuse limits.

-- ---------------------------------------------------------------------------
-- Storage buckets (previously created by hand outside the repo)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('id-cards', 'id-cards', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own id delete" on storage.objects;
create policy "own id delete" on storage.objects for delete to authenticated
  using (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only approved students can sign photos, and only for approved profiles.
create or replace function public.is_approved_folder(_folder text)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when _folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_approved(_folder::uuid)
    else false
  end
$$;

drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select to authenticated using (
  bucket_id = 'photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role(auth.uid(), 'admin')
    or (public.is_approved(auth.uid()) and public.is_approved_folder((storage.foldername(name))[1]))
  )
);

drop policy if exists "id read" on storage.objects;
create policy "id read" on storage.objects for select to authenticated using (
  bucket_id = 'id-cards' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role(auth.uid(), 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- Referential integrity (new rows are enforced; NOT VALID keeps old rows
-- migratable if a database already contains orphans)
-- ---------------------------------------------------------------------------
alter table public.verifications
  add constraint verifications_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade not valid;

alter table public.verifications
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.profiles
  add column if not exists suspended_at timestamptz;

alter table public.blocks
  add constraint blocks_blocker_fkey foreign key (blocker) references auth.users(id) on delete cascade not valid,
  add constraint blocks_blocked_fkey foreign key (blocked) references auth.users(id) on delete cascade not valid,
  add constraint blocks_not_self check (blocker <> blocked) not valid;

alter table public.swipes
  add constraint swipes_swiper_fkey foreign key (swiper) references auth.users(id) on delete cascade not valid,
  add constraint swipes_target_fkey foreign key (target) references auth.users(id) on delete cascade not valid,
  add constraint swipes_not_self check (swiper <> target) not valid;

alter table public.matches
  add constraint matches_user_a_fkey foreign key (user_a) references auth.users(id) on delete cascade not valid,
  add constraint matches_user_b_fkey foreign key (user_b) references auth.users(id) on delete cascade not valid;

alter table public.messages
  add constraint messages_sender_id_fkey
    foreign key (sender_id) references auth.users(id) on delete cascade not valid;

alter table public.reports
  add constraint reports_reporter_fkey foreign key (reporter) references auth.users(id) on delete cascade not valid,
  add constraint reports_reported_fkey foreign key (reported) references auth.users(id) on delete cascade not valid,
  add constraint reports_not_self check (reporter <> reported) not valid;

-- Suspended accounts keep their data but lose approved access.
create or replace function public.is_approved(_uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    join public.verifications v on v.user_id = p.id
    where p.id = _uid and p.onboarded and v.status = 'approved'
      and p.suspended_at is null
      and p.birthdate is not null and p.birthdate <= (current_date - interval '18 years')
      and lower(p.email) like '%@stu.adamasuniversity.ac.in'
  )
$$;

-- ---------------------------------------------------------------------------
-- Constraints that used to live only in the browser
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) <= 40) not valid,
  add constraint profiles_course_length
    check (course is null or char_length(course) <= 60) not valid,
  add constraint profiles_year_length
    check (year is null or char_length(year) <= 20) not valid,
  add constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 300) not valid,
  add constraint profiles_interests_count
    check (cardinality(interests) <= 8) not valid,
  add constraint profiles_gender_valid
    check (gender is null or gender in ('woman', 'man', 'nonbinary')) not valid,
  add constraint profiles_interested_in_valid
    check (interested_in is null or interested_in in ('everyone', 'woman', 'man', 'nonbinary')) not valid,
  add constraint profiles_onboarded_complete
    check (
      not onboarded or (
        nullif(trim(display_name), '') is not null
        and birthdate is not null
        and gender is not null
        and gender in ('woman', 'man', 'nonbinary')
        and cardinality(photo_paths) between 1 and 6
        and jsonb_array_length(prompts) between 1 and 3
      )
    ) not valid;

alter table public.verifications
  add constraint verifications_id_path_owned
    check (id_card_path like user_id::text || '/%') not valid;

-- Replace the profile guard so null/blank array entries cannot sneak past the
-- photo and prompt checks.
create or replace function public.guard_profile()
returns trigger language plpgsql set search_path = public
as $$
declare p text; i text; q jsonb;
begin
  new.email := old.email;
  if new.birthdate is not null and new.birthdate > (current_date - interval '18 years') then
    raise exception 'You must be 18 or older to join';
  end if;
  foreach p in array coalesce(new.photo_paths, '{}') loop
    if p is null or p = '' or p not like new.id::text || '/%' then
      raise exception 'Photos must be your own uploads';
    end if;
  end loop;
  foreach i in array coalesce(new.interests, '{}') loop
    if i is null or length(trim(i)) = 0 or length(i) > 40 then
      raise exception 'Interests must be short, non-empty tags';
    end if;
  end loop;
  for q in select * from jsonb_array_elements(coalesce(new.prompts, '[]'::jsonb)) loop
    if jsonb_typeof(q->'question') <> 'string' or jsonb_typeof(q->'answer') <> 'string'
       or length(trim(q->>'question')) = 0 or length(q->>'question') > 120
       or length(trim(q->>'answer')) = 0 or length(q->>'answer') > 200 then
      raise exception 'Each prompt needs a question and an answer of up to 200 characters';
    end if;
  end loop;
  new.photo_path := new.photo_paths[1];
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Privacy: authenticated users can read every profile column except email.
-- Admins get emails through the RPC below instead of a table-wide grant.
-- ---------------------------------------------------------------------------
revoke select, insert, update on public.profiles from authenticated;
grant select (
  id,
  display_name,
  birthdate,
  gender,
  interested_in,
  course,
  year,
  bio,
  interests,
  photo_path,
  photo_paths,
  prompts,
  onboarded,
  created_at
) on public.profiles to authenticated;
grant update (
  display_name,
  birthdate,
  gender,
  interested_in,
  course,
  year,
  bio,
  interests,
  photo_path,
  photo_paths,
  prompts,
  onboarded
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Guard updates for verification review metadata
-- ---------------------------------------------------------------------------
create or replace function public.guard_verification()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    new.status := 'pending';
    new.note := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.submitted_at := now();
  else
    if tg_op = 'UPDATE' and new.status <> old.status then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    end if;
  end if;
  return new;
end $$;

-- Messages require the sender to still be approved, not just matched.
drop policy if exists "participants send" on public.messages;
create policy "participants send" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_approved(auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and auth.uid() in (m.user_a, m.user_b)
        and not public.is_blocked_between(m.user_a, m.user_b)
    )
  );

-- Reporters can see the reports they filed.
drop policy if exists "reporters read own reports" on public.reports;
create policy "reporters read own reports" on public.reports for select to authenticated
  using (reporter = auth.uid());

-- ---------------------------------------------------------------------------
-- Indexes for the queries the app actually runs
-- ---------------------------------------------------------------------------
create index if not exists messages_match_created_idx
  on public.messages (match_id, created_at);
create index if not exists matches_user_a_created_idx
  on public.matches (user_a, created_at desc);
create index if not exists matches_user_b_created_idx
  on public.matches (user_b, created_at desc);
create index if not exists blocks_blocked_idx on public.blocks (blocked);
create index if not exists swipes_target_idx on public.swipes (target);
create index if not exists verifications_pending_idx
  on public.verifications (submitted_at) where status = 'pending';
create index if not exists reports_open_idx
  on public.reports (created_at) where status = 'open';

-- New matches should update the matches screen in realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Server-side discovery: filter swipes/preferences/blocking *before* the limit.
-- ---------------------------------------------------------------------------
create or replace function public.discover_profiles(_limit integer default 30)
returns table (
  id uuid,
  display_name text,
  birthdate date,
  gender text,
  interested_in text,
  course text,
  year text,
  bio text,
  interests text[],
  photo_paths text[],
  prompts jsonb
)
language sql volatile security invoker set search_path = public
as $$
  select
    p.id, p.display_name, p.birthdate, p.gender, p.interested_in,
    p.course, p.year, p.bio, p.interests, p.photo_paths, p.prompts
  from public.profiles p
  join public.profiles me on me.id = auth.uid()
  where p.id <> me.id
    and public.is_approved(p.id)
    and not exists (
      select 1 from public.swipes s where s.swiper = me.id and s.target = p.id
    )
    and (me.interested_in is null or me.interested_in = 'everyone' or p.gender = me.interested_in)
    and (p.interested_in is null or p.interested_in = 'everyone' or p.interested_in = me.gender)
  order by random()
  limit greatest(1, least(coalesce(_limit, 30), 100));
$$;

-- Matches with the other profile and latest message in one round trip.
create or replace function public.match_overview()
returns table (
  match_id uuid,
  other_id uuid,
  display_name text,
  photo_path text,
  course text,
  last_message text,
  last_message_at timestamptz
)
language sql stable security invoker set search_path = public
as $$
  select
    m.id,
    p.id,
    p.display_name,
    p.photo_path,
    p.course,
    last.body,
    coalesce(last.created_at, m.created_at)
  from public.matches m
  join public.profiles p
    on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  left join lateral (
    select msg.body, msg.created_at
    from public.messages msg
    where msg.match_id = m.id
    order by msg.created_at desc
    limit 1
  ) last on true
  where auth.uid() in (m.user_a, m.user_b)
  order by coalesce(last.created_at, m.created_at) desc;
$$;

-- ---------------------------------------------------------------------------
-- Admin helpers (emails are never exposed to ordinary users)
-- ---------------------------------------------------------------------------
create or replace function public.admin_pending_verifications()
returns table (
  user_id uuid,
  id_card_path text,
  status text,
  note text,
  submitted_at timestamptz,
  display_name text,
  email text,
  birthdate date,
  course text
)
language sql stable security definer set search_path = public
as $$
  select v.user_id, v.id_card_path, v.status, v.note, v.submitted_at,
         p.display_name, p.email, p.birthdate, p.course
  from public.verifications v
  join public.profiles p on p.id = v.user_id
  where v.status = 'pending'
    and public.has_role(auth.uid(), 'admin')
  order by v.submitted_at;
$$;

create or replace function public.admin_open_reports()
returns table (
  id uuid,
  reason text,
  status text,
  created_at timestamptz,
  reporter uuid,
  reported uuid,
  reporter_name text,
  reported_name text,
  reported_suspended boolean
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.reason, r.status, r.created_at, r.reporter, r.reported,
         rp.display_name, dp.display_name, (dp.suspended_at is not null)
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter
  left join public.profiles dp on dp.id = r.reported
  where r.status = 'open'
    and public.has_role(auth.uid(), 'admin')
  order by r.created_at;
$$;

create or replace function public.admin_set_suspended(_user_id uuid, _suspended boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admins only';
  end if;
  if _user_id = auth.uid() then
    raise exception 'You cannot suspend your own account';
  end if;
  update public.profiles
  set suspended_at = case when _suspended then now() else null end
  where id = _user_id;
end $$;

create or replace function public.admin_suspended_users()
returns table (
  user_id uuid,
  display_name text,
  email text,
  suspended_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.display_name, p.email, p.suspended_at
  from public.profiles p
  where p.suspended_at is not null
    and public.has_role(auth.uid(), 'admin')
  order by p.suspended_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Basic abuse limits
-- ---------------------------------------------------------------------------
create or replace function public.enforce_swipe_rate()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from public.swipes
      where swiper = new.swiper and created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Too many likes. Please take a break and try again later.';
  end if;
  return new;
end $$;
create trigger enforce_swipe_rate
  before insert on public.swipes
  for each row execute function public.enforce_swipe_rate();

create or replace function public.enforce_message_rate()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'You are sending messages too quickly. Please slow down.';
  end if;
  return new;
end $$;
create trigger enforce_message_rate
  before insert on public.messages
  for each row execute function public.enforce_message_rate();

create or replace function public.enforce_report_rate()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from public.reports
      where reporter = new.reporter and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many reports. Please contact a moderator directly if this is urgent.';
  end if;
  return new;
end $$;
create trigger enforce_report_rate
  before insert on public.reports
  for each row execute function public.enforce_report_rate();

-- ---------------------------------------------------------------------------
-- Function privileges: trigger helpers are not RPCs.
-- ---------------------------------------------------------------------------
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_approved(uuid) from public, anon;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
revoke execute on function public.is_approved_folder(text) from public, anon;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_approved(uuid) to authenticated, service_role;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_approved_folder(text) to authenticated, service_role;

revoke execute on function public.guard_profile() from public, anon, authenticated;
revoke execute on function public.guard_verification() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_match_on_like() from public, anon, authenticated;
revoke execute on function public.unmatch_on_block() from public, anon, authenticated;
revoke execute on function public.enforce_swipe_rate() from public, anon, authenticated;
revoke execute on function public.enforce_message_rate() from public, anon, authenticated;
revoke execute on function public.enforce_report_rate() from public, anon, authenticated;

revoke execute on function public.discover_profiles(integer) from public, anon;
revoke execute on function public.match_overview() from public, anon;
revoke execute on function public.admin_pending_verifications() from public, anon;
revoke execute on function public.admin_open_reports() from public, anon;
revoke execute on function public.admin_set_suspended(uuid, boolean) from public, anon;
revoke execute on function public.admin_suspended_users() from public, anon;

grant execute on function public.discover_profiles(integer) to authenticated;
grant execute on function public.match_overview() to authenticated;
grant execute on function public.admin_pending_verifications() to authenticated;
grant execute on function public.admin_open_reports() to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;
grant execute on function public.admin_suspended_users() to authenticated;

-- Ask PostgREST to pick up the new functions and column privileges immediately.
notify pgrst, 'reload schema';
