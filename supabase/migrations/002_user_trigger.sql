
begin;

-- Automatically create the required application records
-- whenever a new user registers through Supabase Auth.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_display_name text;
begin
    new_display_name :=
        coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
            nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
            'Member'
        );

    -- Create the user's public profile.
    insert into public.profiles (id, display_name)
    values (new.id, new_display_name);

    -- Every new account starts with the normal user role.
    insert into public.user_roles (user_id, role)
    values (new.id, 'user');

    -- Initialise quiz statistics for the new account.
    insert into public.user_stats (user_id)
    values (new.id);

    return new;
end;
$$;

-- Prevent clients from calling this privileged function directly.
revoke all on function public.handle_new_user()
from public, anon, authenticated;

-- Recreate the trigger safely if this migration is rerun.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

commit;
