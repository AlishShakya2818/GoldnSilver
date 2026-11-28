
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getServiceRoleKey(): string | undefined {
  try {
    const secretKeys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    );

    if (secretKeys.default) return secretKeys.default;
  } catch {
    // Fall back to the legacy environment variable.
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function extractMedia(post: any) {
  const first = post?.attachments?.data?.[0];

  const imageUrl =
    post?.full_picture ??
    first?.media?.image?.src ??
    first?.subattachments?.data?.[0]?.media?.image?.src ??
    null;

  const mediaType =
    first?.media_type ??
    (imageUrl ? "photo" : "text");

  return { imageUrl, mediaType };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({
      error: "Administrator sign-in is required.",
    }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  const serviceRoleKey = getServiceRoleKey();
  const pageId = Deno.env.get("FACEBOOK_PAGE_ID");
  const pageToken = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN");

  const graphVersion =
    Deno.env.get("META_GRAPH_API_VERSION") ?? "v27.0";

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !pageId ||
    !pageToken
  ) {
    return jsonResponse({
      error:
        "Facebook integration is not configured yet. Add the required Supabase Edge Function secrets.",
    }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: userData, error: userError } =
    await userClient.auth.getUser();

  if (userError || !userData.user) {
    return jsonResponse({
      error: "Your session is invalid. Please sign in again.",
    }, 401);
  }

  const { data: isAdmin, error: adminError } =
    await userClient.rpc("is_admin");

  if (adminError || isAdmin !== true) {
    return jsonResponse({
      error: "Administrator access is required.",
    }, 403);
  }

  const serviceClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  try {
    const fields = [
      "id",
      "message",
      "story",
      "created_time",
      "permalink_url",
      "full_picture",
      "attachments{media_type,media,subattachments}",
    ].join(",");

    // Corrected URL construction: the URL must be a template string.
    const graphUrl = new URL(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/published_posts`,
    );

    graphUrl.searchParams.set("fields", fields);
    graphUrl.searchParams.set("limit", "50");
    graphUrl.searchParams.set("access_token", pageToken);

    const response = await fetch(graphUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    const graphData = await response.json();

    if (!response.ok || graphData.error) {
      console.error(
        "Meta Graph API error:",
        graphData.error?.type ?? "unknown",
      );

      return jsonResponse({
        error:
          "Facebook could not return Page posts. Check the Page token, permissions and Page ID.",
        providerCode: graphData.error?.code ?? null,
        providerMessage:
          graphData.error?.message ?? "Graph API request failed.",
      }, response.status === 429 ? 429 : 502);
    }

    const posts = Array.isArray(graphData.data)
      ? graphData.data
      : [];

    const rows = posts
      .filter(
        (post: any) => post?.id && post?.permalink_url,
      )
      .map((post: any) => {
        const media = extractMedia(post);

        return {
          facebook_post_id: String(post.id),
          message: String(
            post.message ?? post.story ?? "",
          ).slice(0, 20000),
          permalink_url: String(post.permalink_url),
          image_url: media.imageUrl,
          media_type: media.mediaType,
          source_created_at: post.created_time ?? null,
          imported_at: new Date().toISOString(),

          // Preserve existing review_status and approval decisions.
        };
      });

    if (rows.length > 0) {
      const { error: saveError } = await serviceClient
        .from("facebook_posts")
        .upsert(rows, {
          onConflict: "facebook_post_id",
        });

      if (saveError) {
        console.error(
          "Facebook post cache save failed:",
          saveError.message,
        );

        return jsonResponse({
          error:
            "Facebook posts were fetched but could not be saved.",
        }, 500);
      }
    }

    return jsonResponse({
      success: true,
      fetched: posts.length,
      saved: rows.length,
      note:
        "New posts enter the pending review queue. Existing approval decisions are preserved.",
    });
  } catch (error) {
    console.error(
      "Facebook sync failed:",
      error instanceof Error ? error.message : "unknown",
    );

    return jsonResponse({
      error:
        "Facebook synchronisation failed. Please try again.",
    }, 500);
  }
});
