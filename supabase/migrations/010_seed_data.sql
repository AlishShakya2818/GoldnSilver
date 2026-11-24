
begin;

-- Default quiz achievement badges.
insert into public.badges (
    code,
    name,
    description,
    icon,
    is_active
)
values
(
    'streak_7',
    '7-Day Streak',
    'Complete the daily quiz for seven consecutive days.',
    '🔥',
    true
),
(
    'streak_30',
    '30-Day Streak',
    'Complete the daily quiz for thirty consecutive days.',
    '🏆',
    true
),
(
    'correct_100',
    'Century of Correct Answers',
    'Answer one hundred quiz questions correctly.',
    '💯',
    true
)
on conflict (code) do nothing;


-- Default editorial categories.
insert into public.article_categories (
    name,
    slug
)
values
    ('Gold News', 'gold-news'),
    ('Silver News', 'silver-news'),
    ('Market Updates', 'market-updates'),
    ('Nepal Bullion Market', 'nepal-bullion-market'),
    ('International Markets', 'international-markets'),
    ('Business and Economy', 'business-economy'),
    ('Education', 'education')
on conflict (slug) do nothing;

commit;
