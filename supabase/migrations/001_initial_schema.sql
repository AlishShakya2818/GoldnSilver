
-- ============================================================
-- GOLD N SILVER RATES
-- Migration 001: Initial Database Schema
-- Database: Supabase PostgreSQL
-- Timezone for daily quiz: Asia/Kathmandu
-- ============================================================

begin;

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

create type public.app_role as enum (
    'user',
    'admin'
);

create type public.question_difficulty as enum (
    'easy',
    'medium',
    'hard'
);

create type public.content_status as enum (
    'draft',
    'pending_review',
    'published',
    'archived'
);

create type public.metal_type as enum (
    'gold',
    'silver'
);

create type public.prediction_choice as enum (
    'higher',
    'lower'
);

create type public.prediction_status as enum (
    'draft',
    'open',
    'closed',
    'settled',
    'cancelled'
);

create type public.comment_status as enum (
    'pending',
    'approved',
    'rejected',
    'hidden'
);

create type public.article_source_type as enum (
    'manual',
    'facebook',
    'other'
);


-- ============================================================
-- 2. USER ACCOUNTS AND PROFILES
-- ============================================================

create table public.profiles (
    id uuid primary key references auth.users(id)
        on delete cascade,

    display_name text not null
        check (char_length(trim(display_name)) between 1 and 80),

    username text
        check (
            username is null
            or username ~ '^[A-Za-z0-9_]{3,24}$'
        ),

    avatar_url text,

    bio text
        check (bio is null or char_length(bio) <= 280),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_unique
on public.profiles (lower(username))
where username is not null;


create table public.user_roles (
    user_id uuid not null references auth.users(id)
        on delete cascade,

    role public.app_role not null default 'user',

    assigned_at timestamptz not null default now(),

    assigned_by uuid references auth.users(id)
        on delete set null,

    primary key (user_id, role)
);


-- ============================================================
-- 3. DAILY QUIZ QUESTIONS
-- ============================================================

create table public.quiz_questions (
    id uuid primary key default gen_random_uuid(),

    question_text text not null
        check (
            char_length(trim(question_text)) between 1 and 1000
        ),

    difficulty public.question_difficulty not null default 'easy',

    status public.content_status not null default 'draft',

    created_by uuid references auth.users(id)
        on delete set null,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


create table public.quiz_options (
    id uuid primary key default gen_random_uuid(),

    question_id uuid not null references public.quiz_questions(id)
        on delete cascade,

    option_text text not null
        check (
            char_length(trim(option_text)) between 1 and 300
        ),

    position smallint not null
        check (position between 1 and 4),

    unique (question_id, position),

    unique (id, question_id)
);


-- Correct answers are stored separately.
-- Do not expose this table to public website users.

create table public.quiz_answer_keys (
    question_id uuid primary key references public.quiz_questions(id)
        on delete cascade,

    correct_option_id uuid not null,

    explanation text,

    constraint quiz_answer_belongs_to_question
        foreign key (correct_option_id, question_id)
        references public.quiz_options(id, question_id)
        on delete cascade
);


-- Which question is assigned to each Nepal-local calendar date?

create table public.quiz_daily_assignments (
    id uuid primary key default gen_random_uuid(),

    question_id uuid not null references public.quiz_questions(id)
        on delete restrict,

    quiz_date date not null unique,

    is_published boolean not null default false,

    created_by uuid references auth.users(id)
        on delete set null,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique (id, question_id)
);


-- ============================================================
-- 4. GUEST QUIZ SESSIONS
-- ============================================================

-- Guests can play without creating an account.
-- Only a hash of their random session token is stored.

create table public.guest_quiz_sessions (
    id uuid primary key default gen_random_uuid(),

    token_hash text not null unique,

    created_at timestamptz not null default now(),

    expires_at timestamptz not null
        default (now() + interval '30 days'),

    claimed_by uuid references auth.users(id)
        on delete cascade,

    claimed_at timestamptz,

    constraint guest_session_expiry_check
        check (expires_at > created_at),

    constraint guest_session_claim_check
        check (
            (claimed_by is null and claimed_at is null)
            or
            (claimed_by is not null and claimed_at is not null)
        )
);


-- ============================================================
-- 5. QUIZ ATTEMPTS AND POINTS
-- ============================================================

create table public.quiz_attempts (
    id uuid primary key default gen_random_uuid(),

    assignment_id uuid not null,

    question_id uuid not null,

    user_id uuid references auth.users(id)
        on delete cascade,

    guest_session_id uuid references public.guest_quiz_sessions(id)
        on delete cascade,

    selected_option_id uuid not null,

    is_correct boolean not null,

    points_awarded integer not null default 0,

    attempted_at timestamptz not null default now(),

    constraint quiz_attempt_owner_check
        check (
            (user_id is not null)
            <>
            (guest_session_id is not null)
        ),

    constraint quiz_attempt_points_check
        check (
            (is_correct and points_awarded = 10)
            or
            (not is_correct and points_awarded = 0)
        ),

    constraint quiz_attempt_assignment_question_fk
        foreign key (assignment_id, question_id)
        references public.quiz_daily_assignments(id, question_id)
        on delete restrict,

    constraint quiz_attempt_option_question_fk
        foreign key (selected_option_id, question_id)
        references public.quiz_options(id, question_id)
        on delete restrict
);


-- One registered attempt per daily assignment.

create unique index quiz_one_user_attempt_per_day
on public.quiz_attempts (assignment_id, user_id)
where user_id is not null;


-- One guest attempt per daily assignment.

create unique index quiz_one_guest_attempt_per_day
on public.quiz_attempts (assignment_id, guest_session_id)
where guest_session_id is not null;


create index quiz_attempts_user_date_idx
on public.quiz_attempts (user_id, attempted_at desc)
where user_id is not null;


create index quiz_attempts_guest_idx
on public.quiz_attempts (guest_session_id);


-- ============================================================
-- 6. USER STATISTICS
-- ============================================================

create table public.user_stats (
    user_id uuid primary key references auth.users(id)
        on delete cascade,

    total_points integer not null default 0
        check (total_points >= 0),

    total_quiz_attempts integer not null default 0
        check (total_quiz_attempts >= 0),

    correct_answers integer not null default 0
        check (correct_answers >= 0),

    current_streak integer not null default 0
        check (current_streak >= 0),

    longest_streak integer not null default 0
        check (longest_streak >= 0),

    last_quiz_date date,

    updated_at timestamptz not null default now(),

    constraint user_streak_order_check
        check (longest_streak >= current_streak),

    constraint user_correct_answers_check
        check (correct_answers <= total_quiz_attempts)
);


-- ============================================================
-- 7. BADGES AND USER REWARDS
-- ============================================================

create table public.badges (
    id uuid primary key default gen_random_uuid(),

    code text not null unique,

    name text not null,

    description text,

    icon text,

    is_active boolean not null default true,

    created_at timestamptz not null default now()
);


create table public.user_badges (
    user_id uuid not null references auth.users(id)
        on delete cascade,

    badge_id uuid not null references public.badges(id)
        on delete cascade,

    earned_at timestamptz not null default now(),

    primary key (user_id, badge_id)
);


-- ============================================================
-- 8. GOLD AND SILVER PREDICTION CHALLENGE
-- ============================================================

create table public.prediction_rounds (
    id uuid primary key default gen_random_uuid(),

    metal public.metal_type not null,

    provider text not null,

    provider_symbol text not null,

    quote_currency text not null default 'USD',

    opening_price numeric(20, 8),

    settlement_price numeric(20, 8),

    opened_at timestamptz,

    closes_at timestamptz not null,

    settled_at timestamptz,

    status public.prediction_status not null default 'draft',

    created_at timestamptz not null default now(),

    constraint prediction_round_dates_check
        check (closes_at > created_at),

    constraint prediction_round_prices_check
        check (
            (opening_price is null or opening_price > 0)
            and
            (settlement_price is null or settlement_price > 0)
        ),

    constraint prediction_round_opening_check
        check (
            status not in ('open', 'closed', 'settled')
            or
            (opening_price is not null and opened_at is not null)
        ),

    constraint prediction_round_settlement_check
        check (
            status <> 'settled'
            or
            (settlement_price is not null and settled_at is not null)
        )
);


create index prediction_rounds_status_close_idx
on public.prediction_rounds (status, closes_at);


create table public.predictions (
    id uuid primary key default gen_random_uuid(),

    round_id uuid not null references public.prediction_rounds(id)
        on delete cascade,

    user_id uuid not null references auth.users(id)
        on delete cascade,

    choice public.prediction_choice not null,

    is_correct boolean,

    submitted_at timestamptz not null default now(),

    unique (round_id, user_id),

    unique (id, user_id)
);


create index predictions_round_idx
on public.predictions (round_id);


create table public.prediction_comments (
    id uuid primary key default gen_random_uuid(),

    prediction_id uuid not null unique,

    user_id uuid not null,

    comment_text text not null
        check (
            char_length(trim(comment_text)) between 1 and 1000
        ),

    status public.comment_status not null default 'pending',

    moderated_by uuid references auth.users(id)
        on delete set null,

    moderated_at timestamptz,

    moderation_note text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    constraint comment_prediction_owner_fk
        foreign key (prediction_id, user_id)
        references public.predictions(id, user_id)
        on delete cascade
);


-- ============================================================
-- 9. ARTICLE CATEGORIES AND ARTICLES
-- ============================================================

create table public.article_categories (
    id uuid primary key default gen_random_uuid(),

    name text not null unique,

    slug text not null unique,

    created_at timestamptz not null default now()
);


create table public.articles (
    id uuid primary key default gen_random_uuid(),

    category_id uuid references public.article_categories(id)
        on delete set null,

    author_id uuid references auth.users(id)
        on delete set null,

    title text not null
        check (char_length(trim(title)) between 1 and 250),

    slug text not null unique,

    excerpt text,

    body text not null default '',

    featured_image_url text,

    status public.content_status not null default 'draft',

    published_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    constraint article_published_date_check
        check (
            status <> 'published'
            or published_at is not null
        )
);


create index articles_published_idx
on public.articles (published_at desc)
where status = 'published';


create table public.article_sources (
    id uuid primary key default gen_random_uuid(),

    article_id uuid not null references public.articles(id)
        on delete cascade,

    source_type public.article_source_type not null default 'manual',

    source_url text,

    external_post_id text,

    attribution text,

    created_at timestamptz not null default now()
);


create unique index article_external_source_unique
on public.article_sources (source_type, external_post_id)
where external_post_id is not null;


-- ============================================================
-- 10. NEPAL LOCAL GOLD AND SILVER RATES
-- ============================================================

create table public.local_rate_updates (
    id uuid primary key default gen_random_uuid(),

    metal public.metal_type not null,

    rate numeric(18, 4) not null
        check (rate > 0),

    currency text not null default 'NPR',

    unit text not null,

    rate_date date not null,

    source text,

    is_published boolean not null default false,

    entered_by uuid references auth.users(id)
        on delete set null,

    created_at timestamptz not null default now(),

    unique (metal, rate_date, unit, currency)
);


create index local_rates_published_idx
on public.local_rate_updates (rate_date desc)
where is_published = true;


-- ============================================================
-- 11. INTERNATIONAL MARKET PRICE CACHE
-- ============================================================

create table public.market_price_cache (
    id uuid primary key default gen_random_uuid(),

    metal public.metal_type not null,

    provider text not null,

    provider_symbol text not null,

    quote_currency text not null default 'USD',

    price_per_troy_ounce numeric(20, 8) not null
        check (price_per_troy_ounce > 0),

    observed_at timestamptz not null,

    fetched_at timestamptz not null default now(),

    is_stale boolean not null default false,

    raw_payload jsonb
);


create index market_price_cache_metal_date_idx
on public.market_price_cache (metal, fetched_at desc);


-- ============================================================
-- 12. ADMIN AUDIT LOGS
-- ============================================================

create table public.admin_logs (
    id uuid primary key default gen_random_uuid(),

    actor_id uuid references auth.users(id)
        on delete set null,

    action text not null,

    entity_type text not null,

    entity_id uuid,

    details jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()
);


create index admin_logs_created_idx
on public.admin_logs (created_at desc);


-- ============================================================
-- 13. AUTOMATIC UPDATED_AT FUNCTION
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


create trigger quiz_questions_updated_at
before update on public.quiz_questions
for each row
execute function public.set_updated_at();


create trigger quiz_daily_assignments_updated_at
before update on public.quiz_daily_assignments
for each row
execute function public.set_updated_at();


create trigger user_stats_updated_at
before update on public.user_stats
for each row
execute function public.set_updated_at();


create trigger prediction_comments_updated_at
before update on public.prediction_comments
for each row
execute function public.set_updated_at();


create trigger articles_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();


-- ============================================================
-- MIGRATION 001 COMPLETE
-- ============================================================

commit;
