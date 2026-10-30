-- ===========================================================================
-- THE ARENA VR — cross-device setup
-- ---------------------------------------------------------------------------
-- Run this ONCE in your Supabase project:
--   Supabase dashboard  ->  SQL Editor  ->  New query  ->  paste  ->  Run
--
-- It creates the two tables the site needs and, more importantly, the security
-- rules that decide who may read and write what. Those rules are the reason
-- it is safe to put the "anon" key in arena.config.js.
--
-- Summary of who can do what:
--   The public (a customer booking on their phone)  -> may INSERT a booking.
--                                                      May NOT read any.
--   A signed-in manager                             -> may read bookings,
--                                                      read + add expenses.
--   A signed-in director                            -> everything, including
--                                                      deleting and managing
--                                                      staff accounts.
--   A brand new account from signup                 -> NOTHING until a
--                                                      Director activates it.
--
-- ---------------------------------------------------------------------------
-- KNOWN LIMIT — booking data is not trustworthy as a financial record
-- ---------------------------------------------------------------------------
-- The public INSERT policy below has to accept writes from people who are not
-- signed in, because that is how a customer books. It cannot tell a real
-- booking from a made-up one, so somebody could post a booking with any
-- amount and status 'paid'.
--
-- Treat the revenue figures in the Director's View as indicative, not as
-- accounts. The fix is to stop the website writing bookings directly and have
-- a Paystack webhook write them server-side after verifying the payment; the
-- tables below do not need to change for that.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. PROFILES — one row per staff login, holding their role
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  name        text,
  role        text not null default 'manager' check (role in ('manager', 'director')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- When someone is given a login, create their profile automatically.
--
-- ## SECURITY — why role and active are hardcoded here ##
-- Creating a login goes through Supabase's public /auth/v1/signup endpoint,
-- which accepts the anon key — and the anon key is published in the website's
-- source. So ANYONE can reach this trigger, not just the Director.
--
-- An earlier version of this function read the role out of
-- `new.raw_user_meta_data ->> 'role'`. That field is simply the `data` object
-- from the signup request, i.e. entirely attacker-controlled. Anyone could
-- sign up with {"data":{"role":"director"}} and award themselves full access
-- to every booking, salary figure and customer phone number.
--
-- Two rules keep that shut, and both must stay:
--   1. role is always 'manager'. Signup can never grant director.
--   2. active is always false. A new account has NO access until a Director
--      switches it on (Director's View -> Managers -> Re-enable).
--
-- Rule 2 matters on its own: without it, a stranger who signs up is still
-- "staff", and is_staff() alone reads every booking and expense.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'manager',   -- never from raw_user_meta_data: the client controls that
    false        -- no access until a Director activates the account
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Helper functions. SECURITY DEFINER so a policy can check your role without
-- the policy needing to read a table it is itself protecting.
create or replace function public.my_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active = true);
$$;

create or replace function public.is_director()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true and role = 'director'
  );
$$;


-- ---------------------------------------------------------------------------
-- 2. BOOKINGS
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id             bigint generated always as identity primary key,
  ref            text unique not null,
  at             timestamptz not null default now(),
  kind           text,
  line_id        text,
  line           text,
  game           text,
  booking_date   date,
  booking_time   text,
  duration       integer default 0,
  players        integer default 1,
  amount         numeric(12,2) default 0,
  status         text default 'paid',
  customer_name  text,
  customer_phone text,
  customer_email text,
  customer_area  text,
  note           text
);

create index if not exists bookings_at_idx on public.bookings (at desc);
create index if not exists bookings_date_idx on public.bookings (booking_date);


-- ---------------------------------------------------------------------------
-- 3. EXPENSES  (the cost register — managers and directors both write here)
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id           bigint generated always as identity primary key,
  expense_date date not null,
  category     text not null,
  description  text,
  payee        text,
  amount       numeric(12,2) not null default 0,
  entered_by   text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (expense_date desc);


-- ---------------------------------------------------------------------------
-- 4. SECURITY RULES
--    Row Level Security is OFF by default, which would leave everything open.
--    Turning it on and adding these policies is what actually protects you.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.expenses enable row level security;

-- ---- profiles ----
drop policy if exists "staff read profiles" on public.profiles;
create policy "staff read profiles" on public.profiles
  for select to authenticated
  using ( id = auth.uid() or public.is_director() );

drop policy if exists "director updates profiles" on public.profiles;
create policy "director updates profiles" on public.profiles
  for update to authenticated
  using ( public.is_director() )
  with check ( public.is_director() );

-- ---- bookings ----
-- Customers are NOT signed in, so they need this one narrow permission.
-- INSERT only: the public can create a booking and can never read any back.
drop policy if exists "public creates bookings" on public.bookings;
create policy "public creates bookings" on public.bookings
  for insert to anon, authenticated
  with check ( true );

drop policy if exists "staff read bookings" on public.bookings;
create policy "staff read bookings" on public.bookings
  for select to authenticated
  using ( public.is_staff() );

drop policy if exists "director deletes bookings" on public.bookings;
create policy "director deletes bookings" on public.bookings
  for delete to authenticated
  using ( public.is_director() );

-- ---- expenses ----
drop policy if exists "staff read expenses" on public.expenses;
create policy "staff read expenses" on public.expenses
  for select to authenticated
  using ( public.is_staff() );

-- The manager recording costs as they are incurred.
-- `created_by = auth.uid()` pins each entry to whoever actually added it.
-- Without it, a signed-in member of staff could set created_by to a colleague
-- and have the cost register show the wrong person — which defeats the point
-- of the "Entered by" column. The column already defaults to auth.uid() and
-- the website never sends it, so this check is invisible in normal use.
-- (Note: the `entered_by` text shown in the table is a display label typed by
-- the app. created_by is the trustworthy one.)
drop policy if exists "staff add expenses" on public.expenses;
create policy "staff add expenses" on public.expenses
  for insert to authenticated
  with check ( public.is_staff() and created_by = auth.uid() );

-- a manager may remove something they entered by mistake; a director, anything
drop policy if exists "staff delete expenses" on public.expenses;
create policy "staff delete expenses" on public.expenses
  for delete to authenticated
  using ( public.is_director() or created_by = auth.uid() );


-- ===========================================================================
-- 5. LAST STEP — make yourself the Director
-- ---------------------------------------------------------------------------
-- a) In the Supabase dashboard go to Authentication -> Users -> "Add user".
--    Create your own account with an email and password, and tick
--    "Auto Confirm User".
--
-- b) Come back here and run the line below with YOUR email, to promote that
--    account and switch it on. Every new account starts as an inactive
--    manager, including this one, so BOTH columns matter:
--
--        update public.profiles set role = 'director', active = true
--        where email = 'you@example.com';
--
-- c) Put your project URL and anon key into assets/js/arena.config.js under
--    `cloud`. Both are in Settings -> API. Use the "anon / public" key.
--    NEVER use the service_role key in the website.
--
-- After that, sign in at /admin with that email and password.
--
-- ---------------------------------------------------------------------------
-- ADDING A MANAGER (and why it takes two steps now)
-- ---------------------------------------------------------------------------
-- Director's View -> Managers -> fill in the form. The account is created but
-- arrives DISABLED, and the list shows it as "Disabled" with a "Re-enable"
-- button. Click that and they can sign in on any device.
--
-- The extra click is the point. Account creation runs through the public
-- signup endpoint, which anyone holding the anon key can call — and the anon
-- key is in the website's source. Because new accounts start inactive, a
-- stranger who signs up gets an inert row instead of access to your data.
--
-- If you never want to create managers from the app, you can also turn
-- signups off entirely: Authentication -> Providers -> Email -> untick
-- "Allow new users to sign up". Create staff from the dashboard instead.
-- Belt and braces; the trigger above is what actually protects you.
--
-- ---------------------------------------------------------------------------
-- RE-RUNNING THIS SCRIPT
-- ---------------------------------------------------------------------------
-- Safe to run again on an existing project: the tables use "if not exists",
-- the functions use "create or replace", and each policy is dropped before
-- being recreated. Existing rows are NOT touched, so if you are applying this
-- as a security update to a project that already has staff, re-check them:
--
--        select id, email, role, active from public.profiles order by role;
--
-- Anyone who should not be a director, or should not have access at all,
-- needs fixing by hand — the hardened trigger only governs accounts made
-- from now on.
-- ===========================================================================
