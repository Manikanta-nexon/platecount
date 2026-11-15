-- Plate Count database. Paste all of this in Supabase > SQL Editor > Run.
create table weddings (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  event_date date,
  created_at timestamptz default now()
);
create table guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  name text not null,
  phone text,
  token text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,10),
  status text not null default 'waiting',
  headcount int not null default 1,
  veg int not null default 0,
  arrival text,
  replied_at timestamptz
);
alter table weddings enable row level security;
alter table guests enable row level security;

create policy "own weddings" on weddings for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own guests" on guests for all to authenticated
  using (exists (select 1 from weddings w where w.id = guests.wedding_id and w.owner = auth.uid()))
  with check (exists (select 1 from weddings w where w.id = guests.wedding_id and w.owner = auth.uid()));

-- Guests have no login. They use their private link (token) through these two functions only.
create function get_invite(p_token text)
returns table(guest_name text, wedding_name text, event_date date, status text, headcount int, veg int, arrival text)
language sql security definer set search_path = public as $$
  select g.name, w.name, w.event_date, g.status, g.headcount, g.veg, g.arrival
  from guests g join weddings w on w.id = g.wedding_id where g.token = p_token
$$;

create function submit_reply(p_token text, p_status text, p_count int, p_veg int, p_time text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('yes','maybe','no') then raise exception 'bad status'; end if;
  if p_count < 0 or p_count > 20 or p_veg < 0 or p_veg > p_count then raise exception 'bad numbers'; end if;
  update guests set status = p_status, headcount = p_count, veg = p_veg,
    arrival = left(coalesce(p_time,''),30), replied_at = now() where token = p_token;
end $$;

grant execute on function get_invite(text), submit_reply(text,text,int,int,text) to anon, authenticated;
