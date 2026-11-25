document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* ---------------------------------------------------------
     1. LIVE CONTENT SOURCES
     ---------------------------------------------------------
     Nepal retail rates and editorial articles are intentionally
     not hardcoded in the public website. They will be loaded from
     verified sources / approved Supabase content when connected.
     --------------------------------------------------------- */

  const rates = null;
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

  const money = (value) =>
    "Rs. " + Number(value).toLocaleString("en-IN");

  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  /* ---------------------------------------------------------
     4. DATE AND RATE DISPLAY
     --------------------------------------------------------- */

  setText("announcementDate", formattedDate);
  setText("heroDate", formattedDate);
  setText("goldDate", formattedDate);
  setText("silverDate", formattedDate);
  setText("year", today.getFullYear());

  setText("goldRate", "Not available");
  setText("silverRate", "Not available");
  setText("goldChange", "Awaiting verified source");
  setText("silverChange", "Awaiting verified source");

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
    const label = theme === "dark"
      ? "Switch to light theme"
      : "Switch to dark theme";

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
     8. ARTICLE LIST AND FILTERING
     --------------------------------------------------------- */

  const articleGrid = $("articleGrid");
  const featuredContainer = $("featuredArticle");
  const searchInput = $("articleSearch");
  const categoryFilter = $("categoryFilter");
  const emptyMessage = $("articleEmpty");

  function createArticleCard(article) {
    return `
      <article class="article-card" data-article-id="${article.id}" tabindex="0" role="button" aria-label="Read ${escapeHTML(article.title)}">
        <span class="article-card-category">${escapeHTML(article.category.toUpperCase())}</span>
        <h3>${escapeHTML(article.title)}</h3>
        <p>${escapeHTML(article.excerpt)}</p>
        <div class="article-card-bottom">
          <span>${escapeHTML(article.date)}</span>
          <strong>READ STORY ↗</strong>
        </div>
      </article>
    `;
  }

  function renderFeaturedArticle() {
    if (!featuredContainer) return;

    const featured = articles.find((article) => article.featured);

    if (!featured) {
      featuredContainer.hidden = true;
      return;
    }

    featuredContainer.hidden = false;
    featuredContainer.innerHTML = `
      <div class="featured-copy">
        <span class="featured-label">EDITOR'S PICK · ${escapeHTML(featured.category.toUpperCase())}</span>
        <h3>${escapeHTML(featured.title)}</h3>
        <p>${escapeHTML(featured.deck)}</p>
        <span class="featured-read">READ THE STORY →</span>
      </div>
      <div class="featured-art" aria-hidden="true"><span>Au</span></div>
    `;

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
  };

  function renderArticles() {
    if (!articleGrid) return;

    const query = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    const category = categoryFilter
      ? categoryFilter.value
      : "All";

    const filtered = articles.filter((article) => {
      const matchesCategory =
        category === "All" || article.category === category;

      const searchableText = [
        article.title,
        article.deck,
        article.excerpt,
        article.category
      ].join(" ").toLowerCase();

      return matchesCategory && searchableText.includes(query);
    });

    articleGrid.innerHTML = filtered.map(createArticleCard).join("");

    if (emptyMessage) {
      emptyMessage.hidden = filtered.length !== 0;
    }
  }

  renderFeaturedArticle();
  renderArticles();

  if (searchInput) {
    searchInput.addEventListener("input", renderArticles);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", renderArticles);
  }

  if (articleGrid) {
    articleGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-article-id]");
      if (card) openArticle(Number(card.dataset.articleId));
    });

    articleGrid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      const card = event.target.closest("[data-article-id]");
      if (card) {
        event.preventDefault();
        openArticle(Number(card.dataset.articleId));
      }
    });
  }

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
      body.innerHTML = article.paragraphs.map((item) => {
        if (item.heading) {
          return `
            <h2>${escapeHTML(item.heading)}</h2>
            <p>${escapeHTML(item.text)}</p>
          `;
        }

        if (item.quote) {
          return `<blockquote>${escapeHTML(item.quote)}</blockquote>`;
        }

        return "";
      }).join("");
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
      behavior: "instant"
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
      title: "Gold spot / US Dollar"
    },
    silver: {
      symbol: "OANDA:XAGUSD",
      title: "Silver spot / US Dollar"
    }
  };

  let tradingViewStyle = "1"; // 1 = candlesticks, 2 = line
  let tradingViewInterval = "60"; // 60-minute candles

  function mountTradingViewChart() {
    if (!tradingViewContainer) return;

    const selected = tradingViewSymbols[selectedMetal] || tradingViewSymbols.gold;
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

    if (chartTitle) chartTitle.textContent = selected.title;
    if (chartSymbol) chartSymbol.textContent = selected.symbol;

    tradingViewContainer.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.width = "100%";
    widgetContainer.style.height = "100%";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.width = "100%";
    widget.style.height = "100%";

    const attribution = document.createElement("div");
    attribution.className = "tradingview-attribution";

    const attributionLink = document.createElement("a");
    attributionLink.href = `https://www.tradingview.com/symbols/${selected.symbol.replace(":", "-")}/`;
    attributionLink.target = "_blank";
    attributionLink.rel = "noopener noreferrer";
    attributionLink.textContent = "View on TradingView";

    attribution.appendChild(attributionLink);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;

    script.textContent = JSON.stringify({
      autosize: true,
      symbol: selected.symbol,
      interval: tradingViewInterval,
      timezone: "Asia/Kathmandu",
      theme,
      style: tradingViewStyle,
      locale: "en",
      allow_symbol_change: false,
      calendar: false,
      support_host: "https://www.tradingview.com"
    });

    widgetContainer.appendChild(widget);
    widgetContainer.appendChild(attribution);
    widgetContainer.appendChild(script);

    tradingViewContainer.appendChild(widgetContainer);
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

    output.textContent =
      `${value} ${from} = ${result.toFixed(4)} ${to}.`;
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
      text: "For questions, corrections or suggestions, please contact the website administrator. Add your official email address and contact details here before publishing."
    },
    privacy: {
      title: "Privacy policy",
      text: "This page should explain what information the website collects, how it is used, whether cookies or analytics services are used, and how visitors can contact the website about their data. Update this policy to reflect the actual services used by the website."
    },
    disclaimer: {
      title: "Disclaimer",
      text: "Nepal retail gold and silver rates are not currently connected to a verified local source on this website. International market charts are separate reference information and are not Nepal retail quotations. Always verify local rates with a reliable source before making a purchase. Website content is for general information and is not financial advice."
    }
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
    ".section-heading, .rate-card, .chart-panel, .market-aside, .tool-card, .about-strip"
  );

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealTargets.forEach((element) => {
      element.classList.add("reveal");
      revealObserver.observe(element);
    });
  }

  console.log("Gold N Silver Rates loaded successfully.");
});