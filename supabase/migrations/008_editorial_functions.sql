
begin;

-- Publish an article after admin review.
create or replace function public.publish_article(
    p_article_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Administrator permission required';
    end if;

    update public.articles
    set
        status = 'published',
        published_at = coalesce(published_at, now()),
        updated_at = now()
    where id = p_article_id
      and status in ('draft', 'pending_review', 'published');

    if not found then
        raise exception 'Article not found or cannot be published';
    end if;
end;
$$;


-- Return an article to draft or pending review.
create or replace function public.unpublish_article(
    p_article_id uuid,
    p_new_status public.content_status default 'draft'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Administrator permission required';
    end if;

    if p_new_status not in ('draft', 'pending_review', 'archived') then
        raise exception 'Invalid unpublished status';
    end if;

    update public.articles
    set
        status = p_new_status,
        published_at = null,
        updated_at = now()
    where id = p_article_id;

    if not found then
        raise exception 'Article not found';
    end if;
end;
$$;


-- Moderate a prediction comment.
create or replace function public.moderate_prediction_comment(
    p_comment_id uuid,
    p_new_status public.comment_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Administrator permission required';
    end if;

    if p_new_status not in ('approved', 'rejected', 'hidden') then
        raise exception 'Invalid moderation status';
    end if;

    update public.prediction_comments
    set
        status = p_new_status,
        moderated_by = auth.uid(),
        moderated_at = now(),
        updated_at = now()
    where id = p_comment_id;

    if not found then
        raise exception 'Comment not found';
    end if;
end;
$$;


revoke all on function public.publish_article(uuid)
from public, anon, authenticated;

revoke all on function public.unpublish_article(uuid, public.content_status)
from public, anon, authenticated;

revoke all on function public.moderate_prediction_comment(uuid, public.comment_status)
from public, anon, authenticated;

grant execute on function public.publish_article(uuid)
to authenticated;

grant execute on function public.unpublish_article(uuid, public.content_status)
to authenticated;

grant execute on function public.moderate_prediction_comment(uuid, public.comment_status)
to authenticated;

commit;
