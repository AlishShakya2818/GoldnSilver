document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* ---------------------------------------------------------
     1. LIVE CONTENT SOURCES
     ---------------------------------------------------------
     Nepal retail rates and editorial articles are intentionally
     not hardcoded in the public website. They will be loaded from
     verified sources / approved Supabase content when connected.
     --------------------------------------------------------- */

  let rates = null;
  const articles = [];

  /* ---------------------------------------------------------
     2. ELEMENT REFERENCES
     --------------------------------------------------------- */

  const $ = (id) => document.getElementById(id);

  const homePage = $("home");
  const articlePage = $("articlePage");
  const siteHeader = $("siteHeader");
  const footer = $("footer");

  const sidebar = $("sidebar");
  const sidebarOverlay = $("sidebarOverlay");
  const menuButton = $("menuButton");
  const closeSidebar = $("closeSidebar");

  const themeToggle = $("themeToggle");
  const articleThemeToggle = $("articleThemeToggle");

  let selectedMetal = "gold";
  let currentArticleId = null;
  let savedScrollPosition = 0;
  let refreshTradingViewTheme = null;

  /* ---------------------------------------------------------
     3. HELPERS
     --------------------------------------------------------- */

  const money = (value) => "Rs. " + Number(value).toLocaleString("en-IN");

  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function escapeHTML(value) {
    return String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  /* ---------------------------------------------------------
   4. NEPAL RATES AND HISTORICAL DATA
   --------------------------------------------------------- */

  const NEPAL_TIME_ZONE = "Asia/Kathmandu";
  const GRAMS_PER_TOLA = 11.6638038;

  rates = null;
  let nepalRateHistory = {
    gold: [],
    silver: [],
  };

  let nepalChartPeriods = {
    gold: 30,
    silver: 30,
  };

  function getNepalDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: NEPAL_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const values = {};
    parts.forEach((part) => {
      values[part.type] = part.value;
    });

    return `${values.year}-${values.month}-${values.day}`;
  }

  function formatNepalDate(dateString) {
    if (!dateString) return "Date unavailable";

    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  function formatNepalMoney(value) {
    return (
      "Rs. " +
      Number(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function formatNepalTime(value) {
    if (!value) return "";

    return new Intl.DateTimeFormat("en-NP", {
      timeZone: NEPAL_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }).format(new Date(value));
  }

  function setRateCardPending(message = "Today's rate has not been published") {
    setText("goldRate", "Not available");
    setText("silverRate", "Not available");

    setText("goldChange", message);
    setText("silverChange", message);

    setText("goldRate10g", "Per 10g: —");
    setText("silverRate10g", "Per 10g: —");

    const goldFootnote = document.querySelector(".gold-card .rate-footnote");
    const silverFootnote = document.querySelector(
      ".silver-card .rate-footnote",
    );

    if (goldFootnote)
      goldFootnote.textContent = "Waiting for today's published Nepal rate";
    if (silverFootnote)
      silverFootnote.textContent = "Waiting for today's published Nepal rate";
  }

  function updateRateCard(metal, currentRecord, previousRecord) {
    if (!currentRecord) return;

    const rate = Number(currentRecord.rate);
    if (!Number.isFinite(rate) || rate <= 0) return;

    const capitalisedMetal = metal === "gold" ? "gold" : "silver";

    setText(`${capitalisedMetal}Rate`, formatNepalMoney(rate));
    setText(
      `${capitalisedMetal}Date`,
      formatNepalDate(currentRecord.rate_date),
    );

    const per10g = (rate / GRAMS_PER_TOLA) * 10;
    setText(
      `${capitalisedMetal}Rate10g`,
      `Per 10g: ${formatNepalMoney(per10g)}`,
    );

    let comparison = "Published today";

    if (previousRecord) {
      const previousRate = Number(previousRecord.rate);
      const difference = rate - previousRate;

      if (Number.isFinite(previousRate) && previousRate > 0) {
        const percentage = (difference / previousRate) * 100;

        if (difference > 0) {
          comparison = `↑ ${formatNepalMoney(difference)} (${percentage.toFixed(2)}%) vs previous rate`;
        } else if (difference < 0) {
          comparison = `↓ ${formatNepalMoney(Math.abs(difference))} (${Math.abs(percentage).toFixed(2)}%) vs previous rate`;
        } else {
          comparison = "No change from previous rate";
        }
      }
    }

    setText(`${capitalisedMetal}Change`, comparison);

    const footnote = document.querySelector(`.${metal}-card .rate-footnote`);

    if (footnote) {
      const source = currentRecord.source
        ? `Source: ${currentRecord.source}`
        : "Published Nepal market rate";

      const updated = currentRecord.updated_at || currentRecord.created_at;
      footnote.textContent = updated
        ? `${source} · Updated ${formatNepalTime(updated)}`
        : source;
    }
  }

  function getPreviousRecord(records, currentDate) {
    return records.find((record) => record.rate_date < currentDate) || null;
  }

  async function loadNepalMarketData() {
    const supabase = window.gnsSupabase;
    const todayString = getNepalDateString();

    setText("announcementDate", formattedDate);
    setText("heroDate", formattedDate);
    setText("goldDate", formatNepalDate(todayString));
    setText("silverDate", formatNepalDate(todayString));
    setText("year", new Date().getFullYear());

    if (!supabase) {
      console.error("Nepal rates: Supabase client is not available.");
      setRateCardPending("Rate service unavailable");
      return;
    }

    try {
      // Fetch published Nepal rates for the latest year.
      // The table's public RLS policy restricts visitors to published records.
      const oneYearAgo = new Date(`${todayString}T00:00:00Z`);
      oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() - 365);
      const historyStart = oneYearAgo.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("local_rate_updates")
        .select(
          "metal, rate, currency, unit, rate_date, source, created_at, updated_at",
        )
        .eq("is_published", true)
        .eq("currency", "NPR")
        .eq("unit", "tola")
        .gte("rate_date", historyStart)
        .lte("rate_date", todayString)
        .order("rate_date", { ascending: true });

      if (error) throw error;

      const records = (data || []).filter((record) => {
        return (
          ["gold", "silver"].includes(record.metal) && Number(record.rate) > 0
        );
      });

      nepalRateHistory.gold = records.filter(
        (record) => record.metal === "gold",
      );
      nepalRateHistory.silver = records.filter(
        (record) => record.metal === "silver",
      );

      const todayGold = nepalRateHistory.gold.find(
        (record) => record.rate_date === todayString,
      );

      const todaySilver = nepalRateHistory.silver.find(
        (record) => record.rate_date === todayString,
      );

      // Only show a complete daily publication when both metals exist.
      if (!todayGold || !todaySilver) {
        setRateCardPending("Today's rates are awaiting publication");
        rates = null;
        renderRegionalReference();
      } else {
        rates = {
          gold: Number(todayGold.rate),
          silver: Number(todaySilver.rate),
        };

        updateRateCard(
          "gold",
          todayGold,
          getPreviousRecord(
            nepalRateHistory.gold.slice().reverse(),
            todayString,
          ),
        );

        updateRateCard(
          "silver",
          todaySilver,
          getPreviousRecord(
            nepalRateHistory.silver.slice().reverse(),
            todayString,
          ),
        );
      }

      renderNepalCharts();
      renderRegionalReference();
    } catch (error) {
      console.error("Could not load Nepal market rates:", error);
      setRateCardPending("Unable to load today's rates");
      rates = null;
      renderRegionalReference();
    }
  }

  function renderRegionalReference() {
    const container = $("regionalGrid");
    if (!container) return;
    container.replaceChildren();

    const card = document.createElement("article");
    card.className = "regional-reference-card";
    const label = document.createElement("span");
    label.className = "panel-label";
    label.textContent = "NATIONAL REFERENCE · NPR / TOLA";
    const heading = document.createElement("strong");
    heading.textContent = "Published Nepal market rates";
    const gold = document.createElement("p");
    gold.textContent = `Gold: ${rates?.gold ? formatNepalMoney(rates.gold) : "Not published"}`;
    const silver = document.createElement("p");
    silver.textContent = `Silver: ${rates?.silver ? formatNepalMoney(rates.silver) : "Not published"}`;
    const note = document.createElement("small");
    note.textContent = "Separate city-level quotations are not independently verified here. Confirm the final price with your jeweller.";
    card.append(label, heading, gold, silver, note);
    container.appendChild(card);
  }

  /* Load the latest published rates and historical records. */
  loadNepalMarketData();

  /* ---------------------------------------------------------
   4A. NEPAL HISTORICAL CHARTS
   Uses native canvas; no additional chart library required.
   --------------------------------------------------------- */

  function drawNepalChart(metal) {
    const canvas = $(metal === "gold" ? "nepalGoldChart" : "nepalSilverChart");

    const emptyMessage = $(
      metal === "gold" ? "nepalGoldChartEmpty" : "nepalSilverChartEmpty",
    );

    const summary = $(
      metal === "gold" ? "nepalGoldChartSummary" : "nepalSilverChartSummary",
    );

    if (!canvas) return;

    const period = nepalChartPeriods[metal] || 30;
    const history = nepalRateHistory[metal] || [];

    const cutoff = new Date(`${getNepalDateString()}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - period);

    const cutoffString = cutoff.toISOString().slice(0, 10);

    const visibleRecords = history.filter((record) => {
      return record.rate_date >= cutoffString;
    });

    const context = canvas.getContext("2d");
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    const height = 260;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.height = `${height}px`;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    if (visibleRecords.length === 0) {
      if (emptyMessage) emptyMessage.hidden = false;
      canvas.hidden = true;
      if (summary) summary.textContent = "Waiting for published historical records";
      return;
    }

    canvas.hidden = false;
    if (emptyMessage) emptyMessage.hidden = true;

    const values = visibleRecords.map((record) => Number(record.rate));
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const range = Math.max(maximum - minimum, maximum * 0.01, 1);

    const padding = {
      top: 20,
      right: 18,
      bottom: 42,
      left: 76,
    };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const x = (index) => {
      if (visibleRecords.length === 1) return padding.left + chartWidth / 2;
      return padding.left + (index / (visibleRecords.length - 1)) * chartWidth;
    };

    const y = (value) => {
      return (
        padding.top +
        ((maximum + range * 0.08 - value) / (range * 1.16)) * chartHeight
      );
    };

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue("--muted").trim() || "#85877c";
    const gridColor = styles.getPropertyValue("--line").trim() || "#dcd5c7";
    const lineColor = metal === "gold" ? "#b18b43" : "#84968b";

    context.font = "11px DM Sans, sans-serif";
    context.textBaseline = "middle";

    // Horizontal guide lines and value labels.
    for (let i = 0; i <= 4; i++) {
      const value = maximum + range * 0.08 - (i / 4) * (range * 1.16);

      const positionY = padding.top + (i / 4) * chartHeight;

      context.beginPath();
      context.strokeStyle = gridColor;
      context.lineWidth = 1;
      context.moveTo(padding.left, positionY);
      context.lineTo(width - padding.right, positionY);
      context.stroke();

      context.fillStyle = textColor;
      context.textAlign = "right";
      context.fillText(
        Math.round(value).toLocaleString("en-IN"),
        padding.left - 9,
        positionY,
      );
    }

    // Price line.
    context.beginPath();
    context.strokeStyle = lineColor;
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.lineCap = "round";

    visibleRecords.forEach((record, index) => {
      const pointX = x(index);
      const pointY = y(Number(record.rate));

      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    });

    context.stroke();

    // Draw a visible marker even when only one published day exists.
    if (visibleRecords.length === 1) {
      context.beginPath();
      context.fillStyle = lineColor;
      context.arc(x(0), y(Number(visibleRecords[0].rate)), 4, 0, Math.PI * 2);
      context.fill();
    }

    // Date labels: first, middle and last, without duplicate labels.
    const labelIndexes = [...new Set([
      0,
      Math.floor((visibleRecords.length - 1) / 2),
      visibleRecords.length - 1,
    ])];

    context.fillStyle = textColor;
    context.textAlign = "center";

    labelIndexes.forEach((index) => {
      const date = visibleRecords[index].rate_date;
      const label = date.slice(5).replace("-", "/");

      context.fillText(label, x(index), height - 17);
    });

    if (summary) {
      const first = values[0];
      const latest = values[values.length - 1];
      const change = latest - first;
      const direction = change > 0 ? "↑" : change < 0 ? "↓" : "—";

      summary.textContent = visibleRecords.length === 1
        ? "1 published record · A trend will appear after another daily rate is published"
        : `${visibleRecords.length} published records · ${direction} ${formatNepalMoney(Math.abs(change))} over this period`;
    }
  }

  function renderNepalCharts() {
    drawNepalChart("gold");
    drawNepalChart("silver");
  }

  document
    .querySelectorAll("[data-nepal-metal][data-nepal-period]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const metal = button.dataset.nepalMetal;
        const period = Number(button.dataset.nepalPeriod);

        if (!["gold", "silver"].includes(metal)) return;
        if (![7, 30, 90, 365].includes(period)) return;

        nepalChartPeriods[metal] = period;

        const group = document.querySelectorAll(
          `[data-nepal-metal="${metal}"]`,
        );

        group.forEach((tab) => {
          tab.classList.toggle(
            "active",
            Number(tab.dataset.nepalPeriod) === period,
          );
        });

        drawNepalChart(metal);
      });
    });

  window.addEventListener("resize", () => {
    renderNepalCharts();
  });

  /* ---------------------------------------------------------
     5. THEME MANAGEMENT
     --------------------------------------------------------- */

  function getSavedTheme() {
    try {
      return localStorage.getItem("goldSilverTheme") || "light";
    } catch {
      return "light";
    }
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;

    const icon = theme === "dark" ? "☀" : "☾";
    const label =
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

    setText("themeIcon", icon);
    setText("articleThemeIcon", icon);

    if (themeToggle) themeToggle.setAttribute("aria-label", label);
    if (articleThemeToggle) {
      articleThemeToggle.setAttribute("aria-label", label);
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.content = theme === "dark" ? "#171e1a" : "#f5f1e8";
    }

    try {
      localStorage.setItem("goldSilverTheme", theme);
    } catch {
      // The page still works if browser storage is unavailable.
    }

    if (refreshTradingViewTheme) {
      refreshTradingViewTheme();
    }
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || "light";
    setTheme(current === "dark" ? "light" : "dark");
  }

  setTheme(getSavedTheme());

  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
  if (articleThemeToggle) {
    articleThemeToggle.addEventListener("click", toggleTheme);
  }

  /* ---------------------------------------------------------
     6. SIDEBAR MENU
     --------------------------------------------------------- */

  function openMenu() {
    if (!sidebar || !sidebarOverlay) return;

    sidebar.classList.add("open");
    sidebarOverlay.classList.add("visible");
    document.body.classList.add("menu-open");

    if (menuButton) {
      menuButton.setAttribute("aria-expanded", "true");
      menuButton.setAttribute("aria-label", "Close navigation");
    }
  }

  function closeMenu() {
    if (sidebar) sidebar.classList.remove("open");
    if (sidebarOverlay) sidebarOverlay.classList.remove("visible");

    document.body.classList.remove("menu-open");

    if (menuButton) {
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation");
    }
  }

  if (menuButton) {
    menuButton.addEventListener("click", () => {
      if (sidebar && sidebar.classList.contains("open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  if (closeSidebar) closeSidebar.addEventListener("click", closeMenu);
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeMenu);

  document.querySelectorAll(".sidebar-nav a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  /* ---------------------------------------------------------
     7. REGIONAL RATES
     --------------------------------------------------------- */

  const regionalGrid = $("regionalGrid");

  if (regionalGrid) {
    regionalGrid.innerHTML = `
      <p class="muted-copy">
        City-wise Nepal rates will appear here after a verified local source
        is connected. We are not displaying estimated or invented city prices.
      </p>
    `;
  }

    /* ---------------------------------------------------------
     8. LIVE EDITORIAL CONTENT
     Published articles are read from Supabase. No demo articles
     or fabricated market updates are inserted in the frontend.
     --------------------------------------------------------- */

  const articleGrid = $("articleGrid");
  const featuredContainer = $("featuredArticle");
  const searchInput = $("articleSearch");
  const categoryFilter = $("categoryFilter");
  const emptyMessage = $("articleEmpty");

  function safeImageUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function articleReadTime(body) {
    const words = String(body || "").trim().split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.ceil(words / 220))} MIN READ`;
  }

  function normaliseArticle(row) {
    const relation = row.article_categories;
    const category = Array.isArray(relation) ? relation[0]?.name : relation?.name;
    const body = String(row.body || "").trim();
    const dateValue = row.published_at || row.created_at;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title || "Untitled story",
      category: category || "Market",
      excerpt: row.excerpt || "",
      deck: row.excerpt || "",
      body,
      date: dateValue ? formatNepalDate(dateValue.slice(0, 10)) : "Date unavailable",
      readTime: articleReadTime(body),
      image: safeImageUrl(row.featured_image_url),
    };
  }

  function renderArticleBody(body) {
    return String(body || "")
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        if (block.startsWith("## ")) return `<h2>${escapeHTML(block.slice(3).trim())}</h2>`;
        if (block.startsWith("> ")) return `<blockquote>${escapeHTML(block.slice(2).trim())}</blockquote>`;
        return `<p>${escapeHTML(block).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  function createArticleCard(article) {
    return `
      <article class="article-card" data-article-id="${escapeHTML(article.id)}" tabindex="0" role="button" aria-label="Read ${escapeHTML(article.title)}">
        <span class="article-card-category">${escapeHTML(article.category.toUpperCase())}</span>
        <h3>${escapeHTML(article.title)}</h3>
        <p>${escapeHTML(article.excerpt)}</p>
        <div class="article-card-bottom">
          <span>${escapeHTML(article.date)}</span>
          <strong>READ STORY ↗</strong>
        </div>
      </article>`;
  }

  function renderFeaturedArticle() {
    if (!featuredContainer) return;
    const featured = articles[0];
    if (!featured) {
      featuredContainer.hidden = true;
      return;
    }
    const art = featured.image
      ? `<div class="featured-art has-image" style="background-image:url('${escapeHTML(featured.image)}')" aria-hidden="true"></div>`
      : `<div class="featured-art" aria-hidden="true"><span>Au</span></div>`;
    featuredContainer.hidden = false;
    featuredContainer.innerHTML = `
      <div class="featured-copy">
        <span class="featured-label">LATEST STORY · ${escapeHTML(featured.category.toUpperCase())}</span>
        <h3>${escapeHTML(featured.title)}</h3>
        <p>${escapeHTML(featured.deck)}</p>
        <span class="featured-read">READ THE STORY →</span>
      </div>${art}`;
    featuredContainer.onclick = () => openArticle(featured.id);
    featuredContainer.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openArticle(featured.id);
      }
    };
    featuredContainer.setAttribute("role", "button");
    featuredContainer.setAttribute("tabindex", "0");
    featuredContainer.setAttribute("aria-label", `Read ${featured.title}`);
  }

  function renderArticles() {
    if (!articleGrid) return;
    const query = searchInput?.value.trim().toLowerCase() || "";
    const category = categoryFilter?.value || "All";
    const filtered = articles.filter((article) => {
      const matchesCategory = category === "All" || article.category.toLowerCase() === category.toLowerCase();
      const searchable = [article.title, article.deck, article.excerpt, article.category].join(" ").toLowerCase();
      return matchesCategory && searchable.includes(query);
    });
    articleGrid.innerHTML = filtered.map(createArticleCard).join("");
    if (emptyMessage) {
      emptyMessage.hidden = filtered.length > 0;
      emptyMessage.textContent = articles.length
        ? "No stories match your search. Try another keyword or topic."
        : "No published stories are available yet. Our editorial team will add verified articles here.";
    }
  }

  async function loadArticles() {
    if (!window.gnsSupabase) {
      if (emptyMessage) {
        emptyMessage.hidden = false;
        emptyMessage.textContent = "The editorial service is temporarily unavailable.";
      }
      return;
    }
    if (articleGrid) articleGrid.innerHTML = '<p class="article-loading">Loading published stories…</p>';
    const { data, error } = await window.gnsSupabase
      .from("articles")
      .select("id,title,slug,excerpt,body,featured_image_url,published_at,created_at,article_categories(name)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Published articles could not load:", error);
      if (articleGrid) articleGrid.replaceChildren();
      if (emptyMessage) {
        emptyMessage.hidden = false;
        emptyMessage.textContent = "Published stories could not be loaded. Please try again later.";
      }
      return;
    }

    articles.splice(0, articles.length, ...(data || []).map(normaliseArticle));
    if (categoryFilter) {
      const existing = new Set([...categoryFilter.options].map((option) => option.value.toLowerCase()));
      [...new Set(articles.map((article) => article.category))].forEach((category) => {
        if (existing.has(category.toLowerCase())) return;
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
      });
    }
    renderFeaturedArticle();
    renderArticles();
  }

  searchInput?.addEventListener("input", renderArticles);
  categoryFilter?.addEventListener("change", renderArticles);
  articleGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-article-id]");
    if (card) openArticle(card.dataset.articleId);
  });
  articleGrid?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-article-id]");
    if (card) {
      event.preventDefault();
      openArticle(card.dataset.articleId);
    }
  });

  loadArticles();

  /* ---------------------------------------------------------
     9. DEDICATED ARTICLE READING PAGE
     --------------------------------------------------------- */

  function openArticle(id) {
    const article = articles.find((item) => item.id === id);
    if (!article) return;

    currentArticleId = id;
    savedScrollPosition = window.scrollY;

    setText("readingCategory", article.category.toUpperCase());
    setText("readingDate", article.date);
    setText("readingTitle", article.title);
    setText("readingDeck", article.deck);
    setText("readingTime", article.readTime);

    const body = $("readingBody");

    if (body) {
      body.innerHTML = renderArticleBody(article.body);
    }

    if (homePage) homePage.hidden = true;
    if (siteHeader) siteHeader.hidden = true;
    if (footer) footer.hidden = true;

    if (articlePage) articlePage.hidden = false;

    closeMenu();
    window.scrollTo({ top: 0, behavior: "instant" });

    document.title = `${article.title} | Gold N Silver Rates`;
    window.history.pushState({ articleId: id }, "", `#article-${id}`);
  }

  function closeArticle() {
    if (articlePage) articlePage.hidden = true;
    if (homePage) homePage.hidden = false;
    if (siteHeader) siteHeader.hidden = false;
    if (footer) footer.hidden = false;

    currentArticleId = null;
    document.title = "Gold N Silver Rates | Nepal";

    if (history.state && history.state.articleId) {
      window.history.replaceState(null, "", "#articles");
    } else {
      window.history.replaceState(null, "", "#articles");
    }

    window.scrollTo({
      top: savedScrollPosition,
      behavior: "instant",
    });
  }

  const articleBack = $("articleBack");
  const articleBackBottom = $("articleBackBottom");

  if (articleBack) articleBack.addEventListener("click", closeArticle);
  if (articleBackBottom) {
    articleBackBottom.addEventListener("click", closeArticle);
  }

  window.addEventListener("popstate", (event) => {
    if (currentArticleId !== null) {
      closeArticle();
    } else if (event.state && event.state.articleId) {
      openArticle(event.state.articleId);
    }
  });

  /* ---------------------------------------------------------
     10. TRADINGVIEW INTERNATIONAL METALS CHART
     TradingView's hosted widget supplies its own market data.
     It does NOT supply Nepal's official retail gold/silver rate.
     --------------------------------------------------------- */

  const tradingViewContainer = $("tradingviewChart");
  const chartTitle = $("chartTitle");
  const chartSymbol = $("chartSymbol");

  const tradingViewSymbols = {
    gold: {
      symbol: "OANDA:XAUUSD",
      title: "Gold spot / US Dollar",
    },
    silver: {
      symbol: "OANDA:XAGUSD",
      title: "Silver spot / US Dollar",
    },
  };

  let tradingViewInterval = "60"; // 60-minute candles

  function mountTradingViewChart() {
    if (!tradingViewContainer) return;

    const selected =
      tradingViewSymbols[selectedMetal] || tradingViewSymbols.gold;
    const theme =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const widget = $("tradingviewWidget");

    if (chartTitle) chartTitle.textContent = selected.title;
    if (chartSymbol) chartSymbol.textContent = selected.symbol;

    if (!widget) {
      tradingViewContainer.textContent = "TradingView chart element is unavailable.";
      return;
    }

    // Use TradingView's official Web Component instead of injecting its
    // legacy embed script dynamically. Its attributes update the chart in place.
    widget.setAttribute("symbol", selected.symbol);
    widget.setAttribute("interval", tradingViewInterval);
    widget.setAttribute("timezone", "Asia/Kathmandu");
    widget.setAttribute("theme", theme);
  }

  document.querySelectorAll(".chart-tab").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMetal = button.dataset.metal === "silver" ? "silver" : "gold";

      document.querySelectorAll(".chart-tab").forEach((tab) => {
        const active = tab.dataset.metal === selectedMetal;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
      });

      mountTradingViewChart();
    });
  });

  // Allow the theme manager (declared earlier) to refresh this hosted widget.
  refreshTradingViewTheme = mountTradingViewChart;
  mountTradingViewChart();

  /* ---------------------------------------------------------
     11. GOLD AND SILVER CALCULATOR
     --------------------------------------------------------- */

  const calculateButton = $("calculateBtn");

  function calculateValue() {
    const metal = $("metalType")?.value || "gold";
    const weight = Number($("weight")?.value);
    const purity = Number($("purity")?.value);
    const output = $("calcOutput");

    if (!output) return;

    if (!Number.isFinite(weight) || weight <= 0) {
      output.textContent = "Please enter a valid weight in grams.";
      return;
    }

    if (!Number.isFinite(purity) || purity <= 0 || purity > 100) {
      output.textContent = "Please select a valid purity.";
      return;
    }

    if (!rates) {
      output.textContent =
        "The Nepal reference rate is not available yet. This calculator will work once a verified local gold and silver rate is connected.";
      return;
    }

    const ratePerTola = metal === "silver" ? rates.silver : rates.gold;
    const gramsPerTola = 11.6638;
    const estimate = (weight / gramsPerTola) * ratePerTola * (purity / 100);

    output.textContent = `Estimated metal value: ${money(estimate)}. This estimate excludes additional charges.`;
  }

  if (calculateButton) {
    calculateButton.addEventListener("click", calculateValue);
  }

  /* ---------------------------------------------------------
     12. TOLA AND GRAM CONVERTER
     --------------------------------------------------------- */

  const convertButton = $("convertBtn");

  function convertWeight() {
    const value = Number($("convertValue")?.value);
    const from = $("convertFrom")?.value;
    const to = $("convertTo")?.value;
    const output = $("convertOutput");

    if (!output) return;

    if (!Number.isFinite(value) || value < 0) {
      output.textContent = "Please enter a valid weight.";
      return;
    }

    let result = value;

    if (from === "tola" && to === "gram") {
      result = value * 11.6638;
    } else if (from === "gram" && to === "tola") {
      result = value / 11.6638;
    }

    output.textContent = `${value} ${from} = ${result.toFixed(4)} ${to}.`;
  }

  if (convertButton) {
    convertButton.addEventListener("click", convertWeight);
  }

  /* ---------------------------------------------------------
     13. INFORMATION MODAL
     --------------------------------------------------------- */

  const infoContent = {
    contact: {
      title: "Contact",
      text: "For questions, corrections or suggestions, please contact the website administrator. Add your official email address and contact details here before publishing.",
    },
    privacy: {
      title: "Privacy policy",
      text: "This page should explain what information the website collects, how it is used, whether cookies or analytics services are used, and how visitors can contact the website about their data. Update this policy to reflect the actual services used by the website.",
    },
    disclaimer: {
      title: "Disclaimer",
      text: "Nepal retail gold and silver rates shown on this website are published by the site administrator and should be checked against the displayed source and date. Rates are quoted in NPR per tola unless stated otherwise. International spot charts are separate reference information and are not Nepal retail quotations. Individual jeweller prices, making charges and taxes may differ. Website content is for general information and is not financial advice.",
    },
  };

  const infoModal = $("infoModal");
  const infoModalTitle = $("infoModalTitle");
  const infoModalText = $("infoModalText");

  function openInfoModal(type) {
    const content = infoContent[type];
    if (!content || !infoModal) return;

    if (infoModalTitle) infoModalTitle.textContent = content.title;
    if (infoModalText) infoModalText.textContent = content.text;

    infoModal.classList.add("open");
    infoModal.setAttribute("aria-hidden", "false");
  }

  function closeInfoModal() {
    if (!infoModal) return;

    infoModal.classList.remove("open");
    infoModal.setAttribute("aria-hidden", "true");
  }

  document.querySelectorAll("[data-info]").forEach((button) => {
    button.addEventListener("click", () => {
      openInfoModal(button.dataset.info);
    });
  });

  const infoModalClose = $("infoModalClose");
  if (infoModalClose) {
    infoModalClose.addEventListener("click", closeInfoModal);
  }

  if (infoModal) {
    infoModal.addEventListener("click", (event) => {
      if (event.target === infoModal) closeInfoModal();
    });
  }

  /* ---------------------------------------------------------
     14. KEYBOARD SHORTCUTS
     --------------------------------------------------------- */

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      closeInfoModal();

      if (currentArticleId !== null) {
        closeArticle();
      }
    }
  });

  /* ---------------------------------------------------------
     15. SUBTLE SECTION REVEALS
     --------------------------------------------------------- */

  const revealTargets = document.querySelectorAll(
    ".section-heading, .rate-card, .chart-panel, .market-aside, .tool-card, .about-strip",
  );

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    revealTargets.forEach((element) => {
      element.classList.add("reveal");
      revealObserver.observe(element);
    });
  }

  console.log("Gold N Silver Rates loaded successfully.");
});
