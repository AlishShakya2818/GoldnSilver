-- 015_facebook_posts.sql
-- Stores imported Facebook Page posts separately from editorial articles.
-- New imports default to pending review. Re-syncs must not overwrite review_status.

create table if not exists public.facebook_posts (
    id uuid primary key default gen_random_uuid(),
    facebook_post_id text not null unique,
    message text,
    permalink_url text not null,
    image_url text,
    media_type text,
    source_created_at timestamptz,
    imported_at timestamptz not null default now(),
    review_status text not null default 'pending'
        check (review_status in ('pending', 'approved', 'rejected', 'hidden')),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    review_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint facebook_posts_permalink_check
        check (permalink_url ~ '^https://(www\.)?facebook\.com/')
);

create index if not exists facebook_posts_status_date_idx
    on public.facebook_posts (review_status, source_created_at desc);

create index if not exists facebook_posts_imported_idx
    on public.facebook_posts (imported_at desc);

alter table public.facebook_posts enable row level security;

drop policy if exists "Public can read approved Facebook posts"
    on public.facebook_posts;
create policy "Public can read approved Facebook posts"
    on public.facebook_posts
    for select
    to anon, authenticated
    using (review_status = 'approved');

drop policy if exists "Admins can manage Facebook posts"
    on public.facebook_posts;
create policy "Admins can manage Facebook posts"
    on public.facebook_posts
    for all
    to authenticated
    using ((select public.is_admin()))
    with check ((select public.is_admin()));

grant select on public.facebook_posts to anon, authenticated;
grant insert, update, delete on public.facebook_posts to authenticated;

-- Service role is used only by the server-side Edge Function and bypasses RLS.
