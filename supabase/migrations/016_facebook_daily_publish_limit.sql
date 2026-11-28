
-- 016_facebook_daily_publish_limit.sql
-- Enforce a maximum of five Facebook posts published on the website
-- per Nepal calendar day.

CREATE TABLE IF NOT EXISTS public.facebook_post_publications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    facebook_post_id uuid NOT NULL
        REFERENCES public.facebook_posts(id),
    published_on date NOT NULL,
    published_at timestamptz NOT NULL DEFAULT now(),
    published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE (facebook_post_id, published_on)
);

CREATE INDEX IF NOT EXISTS facebook_post_publications_day_idx
    ON public.facebook_post_publications (published_on);

ALTER TABLE public.facebook_post_publications
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read Facebook publication history"
    ON public.facebook_post_publications;

CREATE POLICY "Admins can read Facebook publication history"
    ON public.facebook_post_publications
    FOR SELECT
    TO authenticated
    USING ((SELECT public.is_admin()));

GRANT SELECT ON public.facebook_post_publications TO authenticated;

REVOKE INSERT, UPDATE, DELETE
    ON public.facebook_post_publications
    FROM anon, authenticated;

-- Preserve the publication history of posts that were already approved.
INSERT INTO public.facebook_post_publications (
    facebook_post_id,
    published_on,
    published_at,
    published_by
)
SELECT
    id,
    (COALESCE(reviewed_at, updated_at, created_at)
        AT TIME ZONE 'Asia/Kathmandu')::date,
    COALESCE(reviewed_at, updated_at, created_at),
    reviewed_by
FROM public.facebook_posts
WHERE review_status = 'approved'
ON CONFLICT (facebook_post_id, published_on) DO NOTHING;


-- Database-level publishing safeguard.
CREATE OR REPLACE FUNCTION public.enforce_facebook_daily_publish_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_nepal_date date;
    v_count integer;
BEGIN
    IF NEW.review_status <> 'approved' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.review_status = 'approved' THEN
            RETURN NEW;
        END IF;
    END IF;

    v_nepal_date :=
        (clock_timestamp() AT TIME ZONE 'Asia/Kathmandu')::date;

    -- Serialise simultaneous publication requests for the same Nepal day.
    PERFORM pg_advisory_xact_lock(
        hashtext('facebook-post-publish-limit'),
        hashtext(v_nepal_date::text)
    );

    -- Re-approving the same post on the same day does not consume
    -- another publication slot.
    IF EXISTS (
        SELECT 1
        FROM public.facebook_post_publications
        WHERE facebook_post_id = NEW.id
          AND published_on = v_nepal_date
    ) THEN
        RETURN NEW;
    END IF;

    SELECT count(*)::integer
    INTO v_count
    FROM public.facebook_post_publications
    WHERE published_on = v_nepal_date;

    IF v_count >= 5 THEN
        RAISE EXCEPTION
            'Daily website publishing limit reached. Maximum: 5 posts per Nepal calendar day.'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.facebook_post_publications (
        facebook_post_id,
        published_on,
        published_at,
        published_by
    )
    VALUES (
        NEW.id,
        v_nepal_date,
        clock_timestamp(),
        COALESCE(NEW.reviewed_by, auth.uid())
    )
    ON CONFLICT (facebook_post_id, published_on) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_facebook_daily_publish_limit
    ON public.facebook_posts;

CREATE TRIGGER enforce_facebook_daily_publish_limit
AFTER INSERT OR UPDATE OF review_status
ON public.facebook_posts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_facebook_daily_publish_limit();


-- Admin-only function to display today's publishing allowance.
CREATE OR REPLACE FUNCTION public.admin_facebook_publication_stats()
RETURNS TABLE (
    nepal_date date,
    published_today integer,
    daily_limit integer,
    remaining_today integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_date date;
    v_count integer;
BEGIN
    IF NOT COALESCE(public.is_admin(), false) THEN
        RAISE EXCEPTION 'Administrator access required.';
    END IF;

    v_date :=
        (clock_timestamp() AT TIME ZONE 'Asia/Kathmandu')::date;

    SELECT count(*)::integer
    INTO v_count
    FROM public.facebook_post_publications
    WHERE published_on = v_date;

    RETURN QUERY
    SELECT
        v_date,
        v_count,
        5,
        GREATEST(5 - v_count, 0);
END;
$$;

GRANT EXECUTE
    ON FUNCTION public.admin_facebook_publication_stats()
    TO authenticated;

