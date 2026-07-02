-- Run this once in the Supabase SQL Editor (Project > SQL Editor) for the
-- swish84 project. This is the actual security boundary for the `entries`
-- table — the app.js auth checks are just UX, not enforcement.
--
-- Before running: create the owner auth user in
-- Authentication > Users > Add user (email: sjswish84@gmail.com, set a
-- password, toggle "Auto Confirm User"). Also disable
-- Authentication > Providers > Email > "Allow new users to sign up" so no
-- one else can self-register an account.

alter table entries enable row level security;

-- Everyone (including anonymous visitors) can read entries.
create policy "Public read access"
on entries for select
using (true);

-- Only the owner (matched by authenticated email) can create entries.
create policy "Owner can insert entries"
on entries for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'sjswish84@gmail.com');

-- Only the owner can edit entries.
create policy "Owner can update entries"
on entries for update
to authenticated
using (auth.jwt() ->> 'email' = 'sjswish84@gmail.com')
with check (auth.jwt() ->> 'email' = 'sjswish84@gmail.com');

-- Only the owner can delete entries.
create policy "Owner can delete entries"
on entries for delete
to authenticated
using (auth.jwt() ->> 'email' = 'sjswish84@gmail.com');
