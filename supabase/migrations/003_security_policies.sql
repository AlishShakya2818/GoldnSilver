
begin;

-- Helper function: safely check whether the current account is an admin.
-- SECURITY DEFINER allows this function to check user_roles without
-- causing an RLS policy recursion problem.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.user_roles
        where user_id = (select auth.uid())
          and role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;


-- Enable Row Level Security on every application table.

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_daily_assignments enable row level security;
alter table public.guest_quiz_sessions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.user_stats enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.prediction_rounds enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_comments enable row level security;
alter table public.article_categories enable row level security;
alter table public.articles enable row level security;
alter table public.article_sources enable row level security;
alter table public.local_rate_updates enable row level security;
alter table public.market_price_cache enable row level security;
alter table public.admin_logs enable row level security;


-- PROFILES
-- Users can read and update their own profile.
-- Admins can manage all profiles.

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Admins can manage profiles"
on public.profiles
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- USER ROLES
-- Users can see their own role but cannot assign themselves roles.

create policy "Users can read their own roles"
on public.user_roles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can manage user roles"
on public.user_roles
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- QUIZ QUESTIONS
-- Only questions assigned to a published daily quiz are public.

create policy "Public can read published quiz questions"
on public.quiz_questions
for select
to anon, authenticated
using (
    status = 'published'
    and exists (
        select 1
        from public.quiz_daily_assignments a
        where a.question_id = quiz_questions.id
          and a.is_published = true
    )
);

create policy "Admins can manage quiz questions"
on public.quiz_questions
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- QUIZ OPTIONS
-- Options are visible only when their question is assigned
-- to a published daily quiz.

create policy "Public can read published quiz options"
on public.quiz_options
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.quiz_questions q
        join public.quiz_daily_assignments a
          on a.question_id = q.id
        where q.id = quiz_options.question_id
          and q.status = 'published'
          and a.is_published = true
    )
);

create policy "Admins can manage quiz options"
on public.quiz_options
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- QUIZ ANSWER KEYS
-- No public or normal-user policy is created.
-- Only admins can access answer keys directly.

create policy "Admins can manage quiz answer keys"
on public.quiz_answer_keys
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- DAILY QUIZ ASSIGNMENTS

create policy "Public can read published daily assignments"
on public.quiz_daily_assignments
for select
to anon, authenticated
using (is_published = true);

create policy "Admins can manage daily assignments"
on public.quiz_daily_assignments
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- GUEST QUIZ SESSIONS
-- No direct client access. Guest session operations will use
-- controlled backend functions.

create policy "Admins can manage guest quiz sessions"
on public.guest_quiz_sessions
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- QUIZ ATTEMPTS
-- Users can read their own attempts.
-- Attempts must be submitted through a controlled function.

create policy "Users can read their own quiz attempts"
on public.quiz_attempts
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can manage quiz attempts"
on public.quiz_attempts
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- USER STATISTICS

create policy "Users can read their own statistics"
on public.user_stats
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can manage user statistics"
on public.user_stats
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- BADGES
-- Active badges can be viewed publicly.

create policy "Public can read active badges"
on public.badges
for select
to anon, authenticated
using (is_active = true);

create policy "Admins can manage badges"
on public.badges
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- USER BADGES
-- Users can see their own earned badges.

create policy "Users can read their own badges"
on public.user_badges
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can manage user badges"
on public.user_badges
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- PREDICTION ROUNDS
-- Public visitors can view rounds that are open or completed.

create policy "Public can read visible prediction rounds"
on public.prediction_rounds
for select
to anon, authenticated
using (status in ('open', 'closed', 'settled'));


create policy "Admins can manage prediction rounds"
on public.prediction_rounds
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- PREDICTIONS
-- Users can read their own prediction records.
-- Submission and settlement will be handled by controlled functions.

create policy "Users can read their own predictions"
on public.predictions
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can manage predictions"
on public.predictions
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- PREDICTION COMMENTS
-- Only approved comments are publicly visible.
-- Users can read their own comments, including pending ones.

create policy "Public can read approved prediction comments"
on public.prediction_comments
for select
to anon, authenticated
using (status = 'approved');

create policy "Users can read their own prediction comments"
on public.prediction_comments
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can manage prediction comments"
on public.prediction_comments
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- ARTICLE CATEGORIES

create policy "Public can read article categories"
on public.article_categories
for select
to anon, authenticated
using (true);

create policy "Admins can manage article categories"
on public.article_categories
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- ARTICLES
-- Draft, pending and archived articles remain private.

create policy "Public can read published articles"
on public.articles
for select
to anon, authenticated
using (
    status = 'published'
    and published_at is not null
);

create policy "Admins can manage articles"
on public.articles
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- ARTICLE SOURCES
-- Source records are private; admins manage imported source details.

create policy "Admins can manage article sources"
on public.article_sources
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- LOCAL GOLD AND SILVER RATES

create policy "Public can read published local rates"
on public.local_rate_updates
for select
to anon, authenticated
using (is_published = true);

create policy "Admins can manage local rates"
on public.local_rate_updates
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- INTERNATIONAL MARKET PRICE CACHE
-- Public can read cached market prices.
-- Only trusted backend/admin processes should update them.

create policy "Public can read market price cache"
on public.market_price_cache
for select
to anon, authenticated
using (true);

create policy "Admins can manage market price cache"
on public.market_price_cache
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- ADMIN AUDIT LOGS
-- Only admins can view or manage audit records.

create policy "Admins can manage admin logs"
on public.admin_logs
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));


-- Grant basic table permissions.
-- RLS policies above still decide which rows can be accessed.

grant select on public.quiz_questions,
    public.quiz_options,
    public.quiz_daily_assignments,
    public.badges,
    public.prediction_rounds,
    public.prediction_comments,
    public.article_categories,
    public.articles,
    public.local_rate_updates,
    public.market_price_cache
to anon, authenticated;

grant select on all tables in schema public to authenticated;

grant update on public.profiles to authenticated;

grant all privileges on all tables in schema public to authenticated;

commit;
