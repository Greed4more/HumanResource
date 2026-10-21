alter table public.profiles add column photo_paths text[] not null default '{}';

update public.profiles set photo_paths = array[photo_path] where photo_path is not null and cardinality(photo_paths) = 0;

alter table public.profiles add constraint profiles_photo_paths_max check (cardinality(photo_paths) <= 6);

create or replace function public.guard_profile()
returns trigger language plpgsql set search_path = public
as $$
declare p text;
begin
  new.email := old.email;
  if new.birthdate is not null and new.birthdate > (current_date - interval '18 years') then
    raise exception 'You must be 18 or older to join';
  end if;
  foreach p in array coalesce(new.photo_paths, '{}') loop
    if p not like new.id::text || '/%' then
      raise exception 'Photos must be your own uploads';
    end if;
  end loop;
  -- first photo is the main photo shown in matches and chats
  new.photo_path := new.photo_paths[1];
  return new;
end $$;

create policy "own photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
