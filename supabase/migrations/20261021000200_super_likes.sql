-- Super likes: one per person per day (IST), sent with a short message.
-- Sending one also records a normal like so matching works unchanged.

create table public.super_likes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 300 and message ~ '[^[:space:]]'),
  sent_on date not null default ((now() at time zone 'Asia/Kolkata')::date),
  created_at timestamptz not null default now(),
  unique (sender_id, target_id),
  unique (sender_id, sent_on),
  check (sender_id <> target_id)
);
grant select, insert on public.super_likes to authenticated;
grant all on public.super_likes to service_role;
alter table public.super_likes enable row level security;

create policy "send own super like" on public.super_likes for insert to authenticated
  with check (
    sender_id = auth.uid()
    and sender_id <> target_id
    and public.is_approved(auth.uid())
    and public.is_approved(target_id)
    and not public.is_blocked_between(auth.uid(), target_id)
  );

create policy "read own sent or received super likes" on public.super_likes for select to authenticated
  using (sender_id = auth.uid() or target_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create index super_likes_target_created_idx
  on public.super_likes (target_id, created_at desc);

-- Force server-side timestamps and reject a second super like in the same day (IST).
create or replace function public.prepare_super_like()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.created_at := now();
  new.sent_on := (now() at time zone 'Asia/Kolkata')::date;
  if exists (
    select 1 from public.super_likes
    where sender_id = new.sender_id and sent_on = new.sent_on
  ) then
    raise exception 'You have already used your super like today. It resets at midnight IST.';
  end if;
  return new;
end $$;
create trigger prepare_super_like
  before insert on public.super_likes
  for each row execute function public.prepare_super_like();

-- A super like is also a like. Upsert so it overrides an earlier pass.
create or replace function public.handle_super_like()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.swipes (swiper, target, liked)
  values (new.sender_id, new.target_id, true)
  on conflict (swiper, target) do update set liked = true;
  return new;
end $$;
create trigger handle_super_like
  after insert on public.super_likes
  for each row execute function public.handle_super_like();

-- Let the recipient answer from the super-like inbox even if they passed
-- this person before the super like arrived.
create or replace function public.respond_to_super_like(_super_like_id uuid, _liked boolean)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  sl public.super_likes;
  result_match uuid;
begin
  select * into sl
  from public.super_likes
  where id = _super_like_id and target_id = auth.uid();

  if not found then
    raise exception 'Super like not found';
  end if;
  if not public.is_approved(auth.uid()) then
    raise exception 'Your account is not approved to respond yet';
  end if;
  if not public.is_approved(sl.sender_id) or public.is_blocked_between(auth.uid(), sl.sender_id) then
    raise exception 'This person is no longer available';
  end if;

  insert into public.swipes (swiper, target, liked)
  values (auth.uid(), sl.sender_id, _liked)
  on conflict (swiper, target)
    do update set liked = excluded.liked, created_at = now();

  select id into result_match
  from public.matches
  where user_a = least(auth.uid(), sl.sender_id)
    and user_b = greatest(auth.uid(), sl.sender_id);

  return result_match;
end $$;

-- The swipe trigger must also run when a pass is upgraded to a like.
drop trigger if exists on_swipe on public.swipes;
create trigger on_swipe
  after insert or update of liked on public.swipes
  for each row execute function public.create_match_on_like();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'super_likes'
  ) then
    alter publication supabase_realtime add table public.super_likes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'swipes'
  ) then
    alter publication supabase_realtime add table public.swipes;
  end if;
end $$;

revoke execute on function public.prepare_super_like() from public, anon, authenticated;
revoke execute on function public.handle_super_like() from public, anon, authenticated;
revoke execute on function public.respond_to_super_like(uuid, boolean) from public, anon;
grant execute on function public.respond_to_super_like(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
