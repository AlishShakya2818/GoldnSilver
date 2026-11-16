




/* =========================================================
   GOLD N SILVER RATES — WEBSITE INTERACTIONS
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* ---------------------------------------------------------
     1. SAMPLE DATA
     Replace with verified market data when ready.
     --------------------------------------------------------- */

  const rates = {
    gold: 245000,
    silver: 3250,
    goldChange: 1200,
    silverChange: 45
  };

  const regions = [
    { name: "Kathmandu", gold: 245000, silver: 3250 },
    { name: "Pokhara", gold: 245000, silver: 3250 },
    { name: "Lalitpur", gold: 245000, silver: 3250 },
    { name: "Biratnagar", gold: 245000, silver: 3250 },
    { name: "Chitwan", gold: 245000, silver: 3250 },
    { name: "Butwal", gold: 245000, silver: 3250 }
  ];

  const articles = [
    {
      id: 1,
      category: "Gold",
      date: "15 November 2026",
      title: "Understanding Gold Prices in Nepal",
      deck: "A closer look at the forces behind daily gold prices, from international markets to local demand.",
      excerpt: "Gold has long held a special place in Nepal. Understanding how its price moves can help buyers make more informed decisions.",
      readTime: "5 MIN READ",
      featured: true,
      paragraphs: [
        {
          heading: "Gold and its place in Nepal",
          text: "Gold is more than a precious metal in Nepal. It has a place in family celebrations, traditional jewellery, savings and long-term financial planning. For many households, purchasing gold is an important decision that deserves careful consideration."
        },
        {
          heading: "What influences the price?",
          text: "Gold prices in Nepal are influenced by international bullion prices, currency exchange movements, import costs, local demand and the supply available in the market. These factors can move independently, which is one reason prices may change from one day to another."
        },
        {
          quote: "A daily gold rate is a reference point, not the complete cost of a jewellery purchase."
        },
        {
          heading: "Understanding the quoted rate",
          text: "A published rate generally refers to a particular purity and weight measurement. The final amount paid for jewellery can also include making charges, applicable taxes, wastage charges and other costs set by the seller."
        },
        {
          heading: "Before making a purchase",
          text: "Compare rates from reliable sources, ask the seller to explain the purity and weight, and request an itemised bill. It is also useful to understand the difference between the quoted metal value and the final jewellery price."
        }
      ]
    },
    {
      id: 2,
      category: "Silver",
      date: "13 November 2026",
      title: "Silver in Nepal: More Than an Alternative",
      deck: "Explore silver's role in jewellery, everyday use and the wider precious-metals market.",
      excerpt: "Silver often receives less attention than gold, but it has its own market, uses and price movements.",
      readTime: "4 MIN READ",
      paragraphs: [
        {
          heading: "A metal with many uses",
          text: "Silver is used in jewellery, decorative objects, household items and a wide range of industrial applications. Its combination of appearance, workability and electrical conductivity makes it valuable in several industries."
        },
        {
          heading: "What moves silver prices?",
          text: "Silver prices respond to international precious-metals markets, industrial demand, currency movements and investor activity. Because silver has both investment and industrial uses, its market behaviour can differ from gold."
        },
        {
          heading: "Buying silver jewellery",
          text: "When purchasing silver, ask about the item's purity, weight and any additional charges. A clear bill and an understanding of the product's specifications are important."
        },
        {
          heading: "Keeping an eye on the market",
          text: "Rather than relying on a single price update, compare rates over time and check more than one reliable source before making a purchase."
        }
      ]
    },
    {
      id: 3,
      category: "Guides",
      date: "11 November 2026",
      title: "Tola and Gram: A Practical Guide",
      deck: "Understand the traditional tola measurement and how it compares with the metric system.",
      excerpt: "Tola remains a familiar unit in Nepal's gold market. Here's how to convert it into grams.",
      readTime: "3 MIN READ",
      paragraphs: [
        {
          heading: "What is a tola?",
          text: "A tola is a traditional unit of mass commonly used in South Asian precious-metals markets. It is especially familiar to people buying or selling gold and silver in Nepal."
        },
        {
          heading: "The conversion",
          text: "One standard tola is approximately 11.6638 grams. To convert tola into grams, multiply the number of tola by 11.6638. To convert grams into tola, divide the weight in grams by 11.6638."
        },
        {
          heading: "A quick example",
          text: "If an item weighs 2 tola, its approximate metric weight is 23.3276 grams. If an item weighs 10 grams, it is approximately 0.8574 tola."
        },
        {
          heading: "Why the distinction matters",
          text: "When comparing prices, make sure the rate and the item's weight use the same measurement unit. Confusing a per-tola rate with a per-gram weight can lead to an incorrect estimate."
        }
      ]
    },
    {
      id: 4,
      category: "Market",
      date: "9 November 2026",
      title: "What Makes Precious Metal Prices Change?",
      deck: "A beginner-friendly introduction to the global and local factors that influence precious-metals prices.",
      excerpt: "Currency movements, global demand and economic uncertainty can all influence the market.",
      readTime: "6 MIN READ",
      paragraphs: [
        {
          heading: "International market movements",
          text: "Gold and silver are traded internationally. Changes in global supply, demand, investor sentiment and economic expectations can influence the prices quoted in different countries."
        },
        {
          heading: "Currency exchange rates",
          text: "Exchange rates matter because international precious-metals prices are commonly quoted in US dollars. Changes in the value of the local currency can affect the local price even when the international price remains relatively stable."
        },
        {
          heading: "Local market conditions",
          text: "Import costs, local demand, availability and market practices can also influence the price paid by buyers. The local rate is therefore not simply a direct copy of an international quotation."
        },
        {
          heading: "Reading price changes carefully",
          text: "A single day's movement does not necessarily show a long-term trend. Looking at a longer period and understanding the context can provide a more balanced picture."
        }
      ]
    },
    {
      id: 5,
      category: "Gold",
      date: "7 November 2026",
      title: "Understanding Gold Purity: 24K, 22K and 18K",
      deck: "Learn what karat markings mean and why purity matters when comparing jewellery prices.",
      excerpt: "The karat system describes the proportion of gold in an item and is important when evaluating jewellery.",
      readTime: "4 MIN READ",
      paragraphs: [
        {
          heading: "What does karat mean?",
          text: "Karat is a measure of gold purity. Pure gold is described as 24 karat. Lower karat numbers indicate that the item contains a smaller proportion of gold mixed with other metals."
        },
        {
          heading: "Common purity levels",
          text: "22K gold contains approximately 91.6 percent gold. 18K contains 75 percent gold, while 14K contains approximately 58.5 percent gold. These alloys can have different properties, including strength and colour."
        },
        {
          heading: "Why purity affects value",
          text: "The amount of actual gold in an item influences its metal value. When comparing jewellery, consider the weight, purity and additional charges rather than looking only at the total price."
        }
      ]
    },
    {
      id: 6,
      category: "Guides",
      date: "5 November 2026",
      title: "A Buyer's Checklist for Gold Jewellery",
      deck: "A few practical checks to make before purchasing gold jewellery.",
      excerpt: "From purity markings to itemised bills, these simple checks can help buyers feel more confident.",
      readTime: "4 MIN READ",
      paragraphs: [
        {
          heading: "Check the purity",
          text: "Ask the seller to clearly identify the purity of the jewellery. Understand whether it is 24K, 22K, 18K or another standard, and ask what certification or hallmarking information is available."
        },
        {
          heading: "Understand the weight",
          text: "Ask for the item's weight and make sure the measurement is clearly shown. If stones or other materials are included, ask how their weight is treated in the price calculation."
        },
        {
          heading: "Ask about additional charges",
          text: "Making charges, taxes and other fees can affect the final price. Request a breakdown rather than relying on a single total figure."
        },
        {
          heading: "Keep the documentation",
          text: "Keep the bill and any certification or product information provided by the seller. These documents can be useful for future reference."
        }
      ]
    },
    {
      id: 7,
      category: "Market",
      date: "2 November 2026",
      title: "Reading a Daily Gold Rate Update",
      deck: "Learn how to interpret a rate announcement and what information to check before acting on it.",
      excerpt: "A published rate is useful, but understanding its date, unit and purity is just as important.",
      readTime: "3 MIN READ",
      paragraphs: [
        {
          heading: "Check the date first",
          text: "A rate without a clear publication date can be misleading. Always check when the information was updated and whether it is still relevant."
        },
        {
          heading: "Check the unit",
          text: "Gold prices may be quoted per tola or per gram. Confirm the unit before comparing the rate with an item's weight."
        },
        {
          heading: "Check the purity and source",
          text: "Make sure the rate refers to the correct type of gold and comes from a source you trust. A displayed website figure should not automatically be treated as a confirmed selling price."
        }
      ]
    },
    {
      id: 8,
      category: "Silver",
      date: "30 October 2026",
      title: "How to Care for Silver Jewellery",
      deck: "Simple storage and cleaning habits that can help keep silver jewellery looking its best.",
      excerpt: "Silver can tarnish over time. A little care and proper storage can make a difference.",
      readTime: "3 MIN READ",
      paragraphs: [
        {
          heading: "Why silver changes appearance",
          text: "Silver can react with substances in the surrounding environment, causing a darker layer known as tarnish. This is a common process and does not automatically mean the item is damaged."
        },
        {
          heading: "Store it carefully",
          text: "Keep silver jewellery dry and store individual pieces separately where possible. A clean, dry jewellery box or suitable pouch can reduce exposure to moisture and scratches."
        },
        {
          heading: "Clean gently",
          text: "Use a suitable silver-cleaning cloth and follow the manufacturer's care advice. Avoid harsh chemicals or abrasive materials that could damage delicate finishes or stones."
        }
      ]
    }
  ];

  const history = [
    { date: "Nov 06", gold: 241000, silver: 3100 },
    { date: "Nov 07", gold: 242000, silver: 3120 },
    { date: "Nov 08", gold: 241500, silver: 3150 },
    { date: "Nov 09", gold: 243000, silver: 3180 },
    { date: "Nov 10", gold: 242500, silver: 3160 },
    { date: "Nov 11", gold: 244000, silver: 3200 },
    { date: "Nov 12", gold: 243500, silver: 3210 },
    { date: "Nov 13", gold: 244500, silver: 3190 },
    { date: "Nov 14", gold: 243800, silver: 3220 },
    { date: "Nov 15", gold: 245000, silver: 3250 }
  ];

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

  const canvas = $("priceChart");
  const chartContext = canvas ? canvas.getContext("2d") : null;

  let selectedMetal = "gold";
  let currentArticleId = null;
  let savedScrollPosition = 0;
  let chartResizeObserver = null;

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

  setText("goldRate", money(rates.gold));
  setText("silverRate", money(rates.silver));
  setText("goldChange", `▲ ${money(rates.goldChange)}`);
  setText("silverChange", `▲ ${money(rates.silverChange)}`);

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

    drawChart();
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
    regionalGrid.innerHTML = regions.map((region) => `
      <div class="regional-row">
        <span>${escapeHTML(region.name)}</span>
        <strong>${money(region.gold)}</strong>
      </div>
    `).join("");
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
  }

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

    const featured = filtered.find((article) => article.featured);
    const remaining = filtered.filter((article) => article !== featured);

    if (featured && category === "All" && !query) {
      renderFeaturedArticle();
    } else if (featured && category === "Gold" && !query) {
      renderFeaturedArticle();
    } else {
      if (featuredContainer) featuredContainer.hidden = true;
    }

    articleGrid.innerHTML = remaining.map(createArticleCard).join("");

    if (filtered.length === 0) {
      articleGrid.innerHTML = "";
      if (featuredContainer) featuredContainer.hidden = true;
      if (emptyMessage) emptyMessage.hidden = false;
    } else if (emptyMessage) {
      emptyMessage.hidden = true;
    }
  }

  renderArticles();

  if (searchInput) searchInput.addEventListener("input", renderArticles);
  if (categoryFilter) categoryFilter.addEventListener("change", renderArticles);

  if (articleGrid) {
    articleGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-article-id]");
      if (card) openArticle(Number(card.dataset.articleId));
    });

    articleGrid.addEventListener("keydown", (event) => {
      const card = event.target.closest("[data-article-id]");
      if (!card) return;

      if (event.key === "Enter" || event.key === " ") {
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
    history.pushState({ articleId: id }, "", `#article-${id}`);
  }

  function closeArticle() {
    if (articlePage) articlePage.hidden = true;
    if (homePage) homePage.hidden = false;
    if (siteHeader) siteHeader.hidden = false;
    if (footer) footer.hidden = false;

    currentArticleId = null;
    document.title = "Gold N Silver Rates | Nepal";

    if (history.state && history.state.articleId) {
      history.replaceState(null, "", "#articles");
    } else {
      history.replaceState(null, "", "#articles");
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
     10. PRICE HISTORY CHART
     --------------------------------------------------------- */

  function drawChart() {
    if (!canvas || !chartContext) return;

    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 10 || bounds.height < 10) return;

    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);

    chartContext.setTransform(ratio, 0, 0, ratio, 0, 0);

    const width = bounds.width;
    const height = bounds.height;

    const padding = {
      left: 58,
      right: 12,
      top: 18,
      bottom: 30
    };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const values = history.map((item) => item[selectedMetal]);
    const min = Math.min(...values) * .997;
    const max = Math.max(...values) * 1.003;
    const range = max - min || 1;

    const dark = document.documentElement.dataset.theme === "dark";
    const grid = dark ? "#3c473e" : "#e4ded2";
    const text = dark ? "#aeb8ac" : "#85877c";
    const gold = dark ? "#d1ad65" : "#b18b43";

    chartContext.clearRect(0, 0, width, height);
    chartContext.font = "10px DM Sans, Arial";

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + chartHeight * i / 4;
      const value = max - range * i / 4;

      chartContext.beginPath();
      chartContext.strokeStyle = grid;
      chartContext.lineWidth = 1;
      chartContext.moveTo(padding.left, y);
      chartContext.lineTo(width - padding.right, y);
      chartContext.stroke();

      chartContext.fillStyle = text;
      chartContext.textAlign = "right";
      chartContext.fillText(
        Math.round(value).toLocaleString("en-IN"),
        padding.left - 8,
        y + 3
      );
    }

    const points = values.map((value, index) => ({
      x: padding.left + chartWidth * index / (values.length - 1),
      y: padding.top + ((max - value) / range) * chartHeight
    }));

    // Draw the line.
    chartContext.beginPath();
    chartContext.strokeStyle = gold;
    chartContext.lineWidth = 2.3;
    chartContext.lineJoin = "round";
    chartContext.lineCap = "round";

    points.forEach((point, index) => {
      if (index === 0) chartContext.moveTo(point.x, point.y);
      else chartContext.lineTo(point.x, point.y);
    });

    chartContext.stroke();

    // Draw small data points.
    points.forEach((point) => {
      chartContext.beginPath();
      chartContext.fillStyle = gold;
      chartContext.arc(point.x, point.y, 3, 0, Math.PI * 2);
      chartContext.fill();
    });

    // Date labels.
    chartContext.fillStyle = text;
    chartContext.textAlign = "center";

    history.forEach((item, index) => {
      if (index % 2 === 0 || index === history.length - 1) {
        const x = padding.left + chartWidth * index / (history.length - 1);
        chartContext.fillText(item.date, x, height - 7);
      }
    });
  }

  function updateChart() {
    const currentValue = selectedMetal === "gold"
      ? rates.gold
      : rates.silver;

    setText("chartCurrentValue", money(currentValue));

    document.querySelectorAll(".chart-tab").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.metal === selectedMetal
      );
    });

    drawChart();
  }

  document.querySelectorAll(".chart-tab").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMetal = button.dataset.metal === "silver" ? "silver" : "gold";
      updateChart();
    });
  });

  drawChart();

  if (window.ResizeObserver && canvas) {
    chartResizeObserver = new ResizeObserver(drawChart);
    chartResizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", drawChart);
  }

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

    const ratePerTola = metal === "silver" ? rates.silver : rates.gold;
    const gramsPerTola = 11.6638;
    const estimate = (weight / gramsPerTola) * ratePerTola * (purity / 100);

    output.textContent = `Estimated metal value: ${money(estimate)}. This is a sample estimate, excluding additional charges.`;
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
      text: "The prices and information displayed on this demonstration website are sample content. They should not be treated as official market quotations or financial advice. Always verify current rates with a reliable source before making a purchase."
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
