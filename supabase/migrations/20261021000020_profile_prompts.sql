alter table public.profiles add column prompts jsonb not null default '[]'::jsonb;

alter table public.profiles add constraint profiles_prompts_shape check (jsonb_typeof(prompts) = 'array' and jsonb_array_length(prompts) <= 3);

create or replace function public.guard_profile()
returns trigger language plpgsql set search_path = public
as $$
declare p text; q jsonb;
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
  for q in select * from jsonb_array_elements(coalesce(new.prompts, '[]'::jsonb)) loop
    if jsonb_typeof(q->'question') <> 'string' or jsonb_typeof(q->'answer') <> 'string'
       or length(q->>'question') > 120 or length(trim(q->>'answer')) = 0 or length(q->>'answer') > 200 then
      raise exception 'Each prompt needs a question and an answer of up to 200 characters';
    end if;
  end loop;
  -- first photo is the main photo shown in matches and chats
  new.photo_path := new.photo_paths[1];
  return new;
end $$;
