document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const grid = document.getElementById("facebookPostGrid");
  const empty = document.getElementById("facebookPostEmpty");
  const db = window.gnsSupabase;
  if (!grid) return;

  const dateFormatter = new Intl.DateTimeFormat("en-NP", {
    timeZone: "Asia/Kathmandu",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  function makeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPost(post) {
    const card = makeElement("article", "facebook-post-card");
    const media = post.image_url
      ? makeElement("img", "facebook-post-image")
      : null;

    if (media) {
      media.src = post.image_url;
      media.alt = "Image attached to a Gold N Silver Rates Facebook update";
      media.loading = "lazy";
      media.referrerPolicy = "no-referrer";
      media.addEventListener("error", () => media.remove(), { once: true });
      card.append(media);
    }

    const body = makeElement("div", "facebook-post-body");
    const meta = makeElement("div", "facebook-post-meta");
    meta.append(
      makeElement("span", "facebook-post-source", "FACEBOOK UPDATE"),
      makeElement(
        "time",
        "facebook-post-date",
        post.source_created_at
          ? dateFormatter.format(new Date(post.source_created_at))
          : "Date unavailable",
      ),
    );

    const message = makeElement(
      "p",
      "facebook-post-message",
      post.message || "View the original Facebook post for details.",
    );
    const link = makeElement("a", "facebook-post-link", "View original post ↗");
    link.href = post.permalink_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    body.append(meta, message, link);
    card.append(body);
    return card;
  }

  async function loadPosts() {
    if (!db) {
      grid.replaceChildren(makeElement(
        "p",
        "facebook-post-loading",
        "Page updates are temporarily unavailable.",
      ));
      return;
    }

    const { data, error } = await db
      .from("facebook_posts")
      .select("facebook_post_id,message,permalink_url,image_url,media_type,source_created_at")
      .eq("review_status", "approved")
      .order("source_created_at", { ascending: false, nullsFirst: false })
      .limit(6);

    if (error) {
      console.error("Facebook updates could not be loaded:", error.message);
      grid.replaceChildren(makeElement(
        "p",
        "facebook-post-loading",
        "Page updates are temporarily unavailable. Please try again later.",
      ));
      return;
    }

    grid.replaceChildren();
    if (!data?.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    data.forEach((post) => grid.append(renderPost(post)));
  }

  loadPosts();
});
