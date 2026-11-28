/*
 * motion.js — Gold N Silver Rates
 * Works alongside the existing reveal in script.js. Load after it, deferred.
 * Content stays visible if this file fails to load.
 */
(() => {
  "use strict";

  const init = () => {
    const root = document.documentElement;
    root.classList.add("mo-on");

    /* Header shadow + reading progress */
    const header = document.getElementById("siteHeader");
    let bar = null;
    if (header) {
      const wrap = document.createElement("div");
      wrap.className = "mo-progress";
      wrap.setAttribute("aria-hidden", "true");
      bar = document.createElement("i");
      wrap.append(bar);
      header.append(wrap);
    }

    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      if (header) header.classList.toggle("is-scrolled", y > 12);
      if (bar) {
        const max = root.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      }
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();

    /* Reveal extra elements (including ones added later, like Facebook cards) */
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver((entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              obs.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" })
      : null;

    const EXTRA = ".facebook-post-card, .footer-column";

    // Delay by position among earlier revealed siblings (max 5 steps).
    const setOrder = (el) => {
      let i = 0;
      let sib = el.previousElementSibling;
      while (sib && i < 5) {
        if (sib.classList.contains("reveal")) i += 1;
        sib = sib.previousElementSibling;
      }
      el.style.setProperty("--reveal-order", String(i));
    };

    const adopt = (el) => {
      if (el.dataset.moDone) return;
      el.dataset.moDone = "1";
      if (!el.classList.contains("reveal")) {
        if (!observer) return;
        el.classList.add("reveal");
        observer.observe(el);
      }
      setOrder(el);
    };

    const fadeImage = (img) => {
      if (img.complete && img.naturalWidth) img.classList.add("is-loaded");
      else img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
    };

    const scan = (node) => {
      if (node.nodeType !== 1) return;
      if (node.matches(EXTRA)) adopt(node);
      node.querySelectorAll(EXTRA).forEach(adopt);
      if (node.matches("img.facebook-post-image")) fadeImage(node);
      node.querySelectorAll("img.facebook-post-image").forEach(fadeImage);
    };

    scan(document.body);
    // Stagger the reveals script.js already set up.
    document.querySelectorAll(".reveal").forEach(setOrder);

    new MutationObserver((mutations) => {
      mutations.forEach((m) => m.addedNodes.forEach(scan));
    }).observe(document.body, { childList: true, subtree: true });

    /* After a reveal finishes, switch to quick hover transitions. */
    document.addEventListener("transitionend", (e) => {
      const t = e.target;
      if (e.propertyName === "opacity" && t.classList &&
          t.classList.contains("reveal") && t.classList.contains("visible")) {
        t.classList.add("settled");
      }
    }, true);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
