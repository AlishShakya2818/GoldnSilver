document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const db = window.gnsSupabase;
  const accessMessage = $("adminAccessMessage");
  const form = $("questionForm");
  const modal = $("questionModal");
  let questions = [];
  let toastTimer;
  let adminVerified = false;

  const todayNepal = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kathmandu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  function toast(message) {
    const node = $("adminToast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 3200);
  }

  function setAccessMessage(message, type = "") {
    if (!accessMessage) return;
    accessMessage.textContent = message;
    accessMessage.className = `admin-access-message ${type}`.trim();
  }

  function setAdminControls(enabled) {
    const addButton = $("addQuestionButton");
    if (addButton) addButton.disabled = !enabled;
    form
      ?.querySelectorAll("input, textarea, select, button")
      .forEach((node) => {
        node.disabled = !enabled;
      });
    if (!enabled) {
      $("addQuestionButton")?.setAttribute("aria-disabled", "true");
    } else {
      $("addQuestionButton")?.removeAttribute("aria-disabled");
    }
  }

  async function loadOverviewData() {
    if (!adminVerified || !db) return;

    const setValue = (id, value) => {
      const element = $(id);
      if (element) element.textContent = value;
    };

    const countRows = async (table, configure = (query) => query) => {
      let query = db.from(table).select("id", {
        count: "exact",
        head: true,
      });

      query = configure(query);

      const { count, error } = await query;

      if (error) {
        console.error(`Overview ${table} count failed:`, error);
        return null;
      }

      return count ?? 0;
    };

    const [users, activeRounds, pendingComments] = await Promise.all([
      countRows("profiles"),
      countRows("prediction_rounds", (query) =>
        query
          .eq("provider", "nepal_admin_rates")
          .eq("status", "open")
          .gt("closes_at", new Date().toISOString()),
      ),
      countRows("prediction_comments", (query) => query.eq("status", "pending")),
    ]);

    setValue("overviewTotalUsers", users === null ? "Unavailable" : users.toLocaleString());
    setValue("overviewActivePredictions", activeRounds === null ? "Unavailable" : activeRounds.toLocaleString());
    setValue("overviewPendingComments", pendingComments === null ? "Unavailable" : pendingComments.toLocaleString());

    await loadRecentAdminActivity();
  }

  async function loadRecentAdminActivity() {
    const container = $("overviewRecentActivity");

    if (!container || !db || !adminVerified) return;

    const { data, error } = await db
      .from("admin_logs")
      .select("action, entity_type, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Admin activity could not load:", error);
      container.textContent = "Activity history is currently unavailable.";
      return;
    }

    container.replaceChildren();

    if (!data || data.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No administrator activity recorded yet.";
      container.appendChild(empty);
      return;
    }

    data.forEach((item) => {
      const entry = document.createElement("div");
      const dot = document.createElement("span");
      const details = document.createElement("p");
      const title = document.createElement("strong");
      const time = document.createElement("time");

      dot.className = "activity-dot gold";
      title.textContent = `${item.action} · ${item.entity_type}`;

      time.textContent = new Intl.DateTimeFormat("en-NP", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kathmandu",
      }).format(new Date(item.created_at));

      details.append(title, time);
      entry.append(dot, details);
      container.appendChild(entry);
    });
  }

  function openView(name) {
    if (
      ["questions", "predictions", "comments", "editorial", "users", "rewards", "facebook"].includes(name) &&
      !adminVerified
    ) {
      toast("Administrator permission is required.");
      return;
    }

    const view = $("view-" + name);
    if (!view) return;

    document
      .querySelectorAll(".admin-view")
      .forEach((node) => node.classList.remove("active"));

    document
      .querySelectorAll(".admin-nav-link")
      .forEach((node) =>
        node.classList.toggle("active", node.dataset.view === name),
      );

    view.classList.add("active");

    $("pageTitle").textContent =
      {
        questions: "Daily quiz manager",
        predictions: "Nepal market predictions",
        comments: "Comment moderation",
        users: "User management",
        rewards: "Rewards and badges",
        editorial: "Editorial manager",
        facebook: "Facebook post review",
      }[name] || "Dashboard overview";

    $("breadcrumbName").textContent = name.toUpperCase();
    $("adminSidebar")?.classList.remove("open");

    if (name === "questions") {
      loadQuestions().catch((error) => toast(error.message));
    }

    if (name === "predictions") {
      loadPredictions().catch((error) => toast(error.message));
    }

    if (name === "comments") {
      loadComments().catch((error) => toast(error.message));
    }

    if (name === "editorial") {
      loadEditorialData().catch((error) => toast(error.message));
    }
    if (name === "facebook") {
      loadFacebookWorkspace().catch((error) => showFacebookMessage(error.message, true));
    }
    if (name === "users") {
      loadUsers().catch((error) => toast(error.message));
    }
    if (name === "rewards") {
      loadRewards().catch((error) => toast(error.message));
    }
  }

  document.querySelectorAll(".admin-nav-link").forEach((button) => {
    button.addEventListener("click", () => {
      openView(button.dataset.view);
    });
  });
  document
    .querySelectorAll("[data-go]")
    .forEach((button) =>
      button.addEventListener("click", () => openView(button.dataset.go)),
    );
  $("adminMenuButton")?.addEventListener("click", () =>
    $("adminSidebar")?.classList.toggle("open"),
  );

  $("adminSignOutButton")?.addEventListener("click", async () => {
    const button = $("adminSignOutButton");
    if (!db || button.disabled) return;
    button.disabled = true;
    button.textContent = "…";
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      window.location.replace("index.html");
    } catch (error) {
      button.disabled = false;
      button.textContent = "↪";
      setAccessMessage(
        error.message || "Sign out failed. Please try again.",
        "error",
      );
    }
  });

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("adminThemeButton").textContent = theme === "dark" ? "☀" : "☾";
    try {
      localStorage.setItem("goldSilverTheme", theme);
    } catch (_) {}
  }
  applyTheme(localStorage.getItem("goldSilverTheme") || "light");
  $("adminThemeButton")?.addEventListener("click", () =>
    applyTheme(
      document.documentElement.dataset.theme === "dark" ? "light" : "dark",
    ),
  );
  $("adminToday").textContent = new Intl.DateTimeFormat("en-NP", {
    timeZone: "Asia/Kathmandu",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  async function requireAdmin() {
    if (!db)
      throw new Error(
        "Supabase client did not initialise. Check supabase-client.js and the Supabase CDN script.",
      );
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      setAdminControls(false);
      throw new Error(
        "Please sign in on the main website first. If this is an administrator account, signing in there will automatically bring you back to this dashboard.",
      );
    }
    const { data: isAdmin, error } = await db.rpc("is_admin");
    if (error) throw error;
    if (!isAdmin) {
      setAdminControls(false);
      throw new Error(
        "You are signed in, but this account does not have administrator permission. Assign the admin role in Supabase using the SQL instructions provided with this update.",
      );
    }
    setAdminControls(true);
    adminVerified = true;
    const { data: profile } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", sessionData.session.user.id)
      .maybeSingle();
    if (profile?.display_name)
      $("adminProfileName").textContent = profile.display_name;
    document.querySelector(".admin-profile small").textContent =
      "Administrator";
    document.querySelector(".demo-status").innerHTML = "<i></i> ADMIN VERIFIED";
    setAccessMessage(
      "Administrator verified. Daily quiz questions are connected to Supabase.",
      "success",
    );
    $("quizDatabaseHealth").textContent = "● Connected";
    $("quizDatabaseHealth").className = "health-ok";
  }

  async function loadQuestions() {
    if (!db) return;
    const body = $("questionTableBody");
    if (body) {
      body.replaceChildren();
      const loading = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Loading questions from Supabase…";
      loading.appendChild(cell);
      body.appendChild(loading);
    }
    const [qRes, oRes, kRes, aRes] = await Promise.all([
      db
        .from("quiz_questions")
        .select("id,question_text,status,created_at")
        .order("created_at", { ascending: false }),
      db
        .from("quiz_options")
        .select("id,question_id,option_text,position")
        .order("position"),
      db
        .from("quiz_answer_keys")
        .select("question_id,correct_option_id,explanation"),
      db
        .from("quiz_daily_assignments")
        .select("id,question_id,quiz_date,is_published")
        .order("quiz_date", { ascending: true }),
    ]);
    for (const result of [qRes, oRes, kRes, aRes])
      if (result.error) throw result.error;
    const optionsByQuestion = new Map();
    oRes.data.forEach((option) => {
      if (!optionsByQuestion.has(option.question_id))
        optionsByQuestion.set(option.question_id, []);
      optionsByQuestion.get(option.question_id).push(option);
    });
    const keys = new Map(kRes.data.map((key) => [key.question_id, key]));
    const assignments = new Map();
    aRes.data.forEach((item) => {
      if (!assignments.has(item.question_id))
        assignments.set(item.question_id, []);
      assignments.get(item.question_id).push(item);
    });
    questions = qRes.data.map((question) => ({
      ...question,
      options: optionsByQuestion.get(question.id) || [],
      answerKey: keys.get(question.id) || null,
      assignments: assignments.get(question.id) || [],
    }));
    renderQuestions();
    $("overviewQuizPlays").textContent = "—";
    const today = todayNepal();
    const { count, error: countError } = await db
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq(
        "assignment_id",
        (aRes.data.find((a) => a.quiz_date === today) || {}).id ||
          "00000000-0000-0000-0000-000000000000",
      );
    if (!countError) $("overviewQuizPlays").textContent = String(count || 0);
  }

  function cell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  // ==========================================
  // NEPAL DAILY MARKET RATES
  // ==========================================

  const TOLA_IN_GRAMS = 11.6638038;

  function formatNPR(value) {
    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(Number(value))
    ) {
      return "—";
    }

    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  function formatNepalDate(dateString) {
    if (!dateString) return "—";

    const date = new Date(`${dateString}T12:00:00+05:45`);

    return new Intl.DateTimeFormat("en-NP", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kathmandu",
    }).format(date);
  }

  function formatNepalDateTime(timestamp) {
    if (!timestamp) return "—";

    return new Intl.DateTimeFormat("en-NP", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kathmandu",
    }).format(new Date(timestamp));
  }

  function calculatePer10g(rate) {
    const numericRate = Number(rate);

    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      return "—";
    }

    return formatNPR((numericRate / TOLA_IN_GRAMS) * 10);
  }

  function updateNepalRatePreviews() {
    const gold = $("nepalGoldInput")?.value;
    const silver = $("nepalSilverInput")?.value;

    const goldPreview = $("nepalGold10gPreview");
    const silverPreview = $("nepalSilver10gPreview");

    if (goldPreview) {
      goldPreview.textContent = calculatePer10g(gold);
    }

    if (silverPreview) {
      silverPreview.textContent = calculatePer10g(silver);
    }
  }

  function setNepalRatesHealth(status, className) {
    const element = $("nepalRatesHealth");

    if (!element) return;

    element.textContent = `● ${status}`;
    element.className = className;
  }

  async function loadNepalRates() {
    if (!adminVerified || !db) return;

    const today = todayNepal();

    const dateLabel = $("nepalRatesDate");
    const formDateLabel = $("nepalRatesFormDate");
    const reminder = $("nepalRatesReminder");
    const historyBody = $("nepalRatesHistoryBody");

    if (dateLabel) {
      dateLabel.textContent = formatNepalDate(today);
    }

    if (formDateLabel) {
      formDateLabel.textContent = `Nepal market date: ${formatNepalDate(today)}`;
    }

    if (historyBody) {
      historyBody.innerHTML =
        '<tr><td colspan="5">Loading rate history...</td></tr>';
    }

    const columns =
      "metal, rate, currency, unit, rate_date, source, is_published, created_at, updated_at";

    const [todayResult, historyResult] = await Promise.all([
      db
        .from("local_rate_updates")
        .select(columns)
        .eq("rate_date", today)
        .eq("currency", "NPR")
        .eq("unit", "tola"),

      db
        .from("local_rate_updates")
        .select(columns)
        .eq("currency", "NPR")
        .eq("unit", "tola")
        .eq("is_published", true)
        .order("rate_date", { ascending: false })
        .order("metal", { ascending: true })
        .limit(40),
    ]);

    if (todayResult.error) {
      console.error("Today's Nepal rates could not load:", todayResult.error);

      if (reminder) {
        reminder.querySelector("p").textContent =
          "Today's rate status could not be loaded. Please refresh or check the database connection.";
      }

      setNepalRatesHealth("Unavailable", "health-pending");
      toast("Could not load today's Nepal rates.");
      return;
    }

    if (historyResult.error) {
      console.error("Nepal rate history could not load:", historyResult.error);

      if (historyBody) {
        historyBody.innerHTML =
          '<tr><td colspan="5">Rate history is currently unavailable.</td></tr>';
      }
    }

    const todayRows = todayResult.data || [];
    const historyRows = historyResult.data || [];

    const gold = todayRows.find((row) => row.metal === "gold");
    const silver = todayRows.find((row) => row.metal === "silver");

    const publishedGold = gold?.is_published ? gold : null;
    const publishedSilver = silver?.is_published ? silver : null;

    const goldElement = $("adminGoldRate");
    const silverElement = $("adminSilverRate");

    if (goldElement) {
      goldElement.textContent = publishedGold
        ? formatNPR(publishedGold.rate)
        : "—";
    }

    if (silverElement) {
      silverElement.textContent = publishedSilver
        ? formatNPR(publishedSilver.rate)
        : "—";
    }

    const goldUpdated = $("adminGoldRateUpdated");
    const silverUpdated = $("adminSilverRateUpdated");

    if (goldUpdated) {
      goldUpdated.textContent = publishedGold
        ? `Updated ${formatNepalDateTime(publishedGold.updated_at || publishedGold.created_at)}`
        : "Not published today";
    }

    if (silverUpdated) {
      silverUpdated.textContent = publishedSilver
        ? `Updated ${formatNepalDateTime(publishedSilver.updated_at || publishedSilver.created_at)}`
        : "Not published today";
    }

    const bothPublished = Boolean(publishedGold && publishedSilver);

    const statusElement = $("adminRatesStatus");
    const lastUpdatedElement = $("adminRatesLastUpdated");

    if (statusElement) {
      statusElement.textContent = bothPublished ? "Published" : "Pending";
    }

    const latestTimestamp = bothPublished
      ? [
          publishedGold.updated_at,
          publishedGold.created_at,
          publishedSilver.updated_at,
          publishedSilver.created_at,
        ]
          .filter(Boolean)
          .map((value) => new Date(value).getTime())
          .sort((a, b) => b - a)[0]
      : null;

    if (lastUpdatedElement) {
      lastUpdatedElement.textContent = latestTimestamp
        ? `Last updated ${formatNepalDateTime(new Date(latestTimestamp).toISOString())}`
        : "Waiting for both rates";
    }

    if (reminder) {
      const message = reminder.querySelector("p");

      if (message) {
        message.textContent = bothPublished
          ? "Both gold and silver rates are published for today. You can correct the figures by entering the updated values below and publishing again."
          : "Today's Nepal gold and silver rates have not both been published. Enter both rates below to update the website.";
      }

      reminder.classList.toggle("rates-published", bothPublished);
    }

    setNepalRatesHealth(
      bothPublished ? "Today's rates published" : "Today's rates pending",
      bothPublished ? "health-ok" : "health-pending",
    );

    // Populate the form with today's existing records, if present.
    const goldInput = $("nepalGoldInput");
    const silverInput = $("nepalSilverInput");
    const sourceInput = $("nepalRatesSource");

    if (goldInput && publishedGold) {
      goldInput.value = publishedGold.rate;
    }

    if (silverInput && publishedSilver) {
      silverInput.value = publishedSilver.rate;
    }

    if (sourceInput && publishedGold && publishedSilver) {
      sourceInput.value = publishedGold.source || publishedSilver.source || "";
    }

    updateNepalRatePreviews();

    renderNepalRatesHistory(historyRows);
  }

  function renderNepalRatesHistory(rows) {
    const body = $("nepalRatesHistoryBody");

    if (!body) return;

    body.replaceChildren();

    if (!rows.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 5;
      cell.textContent =
        "No published Nepal rate history yet. Your first publication will appear here.";

      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    // Combine the separate gold and silver records by Nepal market date.
    const grouped = new Map();

    rows.forEach((item) => {
      if (!grouped.has(item.rate_date)) {
        grouped.set(item.rate_date, {
          date: item.rate_date,
          gold: null,
          silver: null,
          source: item.source || "",
          updated: item.updated_at || item.created_at,
        });
      }

      const group = grouped.get(item.rate_date);

      if (item.metal === "gold") {
        group.gold = item.rate;
      }

      if (item.metal === "silver") {
        group.silver = item.rate;
      }

      if (item.source) {
        group.source = item.source;
      }

      const currentTime = new Date(group.updated || 0).getTime();
      const itemTime = new Date(
        item.updated_at || item.created_at || 0,
      ).getTime();

      if (itemTime > currentTime) {
        group.updated = item.updated_at || item.created_at;
      }
    });

    [...grouped.values()].forEach((item) => {
      const row = document.createElement("tr");

      const values = [
        formatNepalDate(item.date),
        item.gold === null ? "—" : formatNPR(item.gold),
        item.silver === null ? "—" : formatNPR(item.silver),
        item.source || "—",
        formatNepalDateTime(item.updated),
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      body.appendChild(row);
    });
  }

  function setupNepalRates() {
    const form = $("nepalRatesForm");
    const goldInput = $("nepalGoldInput");
    const silverInput = $("nepalSilverInput");
    const clearButton = $("clearNepalRatesForm");
    const refreshButton = $("refreshNepalRatesButton");

    if (!form || form.dataset.initialised === "true") return;

    form.dataset.initialised = "true";

    goldInput?.addEventListener("input", updateNepalRatePreviews);
    silverInput?.addEventListener("input", updateNepalRatePreviews);

    clearButton?.addEventListener("click", () => {
      form.reset();
      updateNepalRatePreviews();
    });

    refreshButton?.addEventListener("click", loadNepalRates);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!adminVerified || !db) {
        toast("Administrator access is required.");
        return;
      }

      const gold = Number(goldInput?.value);
      const silver = Number(silverInput?.value);
      const source = $("nepalRatesSource")?.value.trim();

      if (!Number.isFinite(gold) || gold <= 0) {
        toast("Enter a valid gold rate greater than zero.");
        goldInput?.focus();
        return;
      }

      if (!Number.isFinite(silver) || silver <= 0) {
        toast("Enter a valid silver rate greater than zero.");
        silverInput?.focus();
        return;
      }

      if (!source) {
        toast("Please enter the source of the rates.");
        $("nepalRatesSource")?.focus();
        return;
      }

      const publishButton = $("publishNepalRatesButton");

      if (publishButton) {
        publishButton.disabled = true;
        publishButton.textContent = "Publishing...";
      }

      try {
        const { data, error } = await db.rpc("admin_save_nepal_rates", {
          p_rate_date: todayNepal(),
          p_gold_rate: gold,
          p_silver_rate: silver,
          p_source: source,
        });

        if (error) {
          console.error("Nepal rates publication failed:", error);
          throw error;
        }

        if (!data?.success) {
          throw new Error("The database did not confirm publication.");
        }

        toast("Gold and silver rates published successfully.");

        await loadNepalRates();
        await loadRecentAdminActivity();
      } catch (error) {
        console.error("Could not publish Nepal rates:", error);

        toast(error.message || "Could not publish the Nepal market rates.");
      } finally {
        if (publishButton) {
          publishButton.disabled = false;
          publishButton.textContent = "Publish both rates";
        }
      }
    });
  }

  function renderQuestions() {
    const tbody = $("questionTableBody");
    if (!tbody) return;
    tbody.replaceChildren();
    $("questionCount").textContent =
      `${questions.length} question${questions.length === 1 ? "" : "s"} in Supabase`;
    questions.forEach((question) => {
      const row = document.createElement("tr");
      const questionCell = document.createElement("td");
      const title = document.createElement("strong");
      title.textContent = question.question_text;
      const small = document.createElement("small");
      small.textContent = `${question.options.length} options · Added ${new Date(question.created_at).toLocaleDateString()}`;
      questionCell.append(title, small);
      const correct = question.options.find(
        (option) => option.id === question.answerKey?.correct_option_id,
      );
      row.append(
        questionCell,
        cell(correct?.option_text || "Answer key not set"),
      );
      const statusCell = document.createElement("td");
      const status = document.createElement("span");
      const activeAssignment = question.assignments.find((a) => a.is_published);
      status.className = `status-chip ${activeAssignment ? "approved" : "pending"}`;
      status.textContent = activeAssignment
        ? `Scheduled · ${activeAssignment.quiz_date}`
        : question.status === "published"
          ? "Published · not scheduled"
          : "Draft";
      statusCell.appendChild(status);
      const actions = document.createElement("td");
      const edit = document.createElement("button");
      edit.className = "table-action";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openQuestionModal(question));
      const remove = document.createElement("button");
      remove.className = "table-action danger";
      remove.style.marginLeft = "6px";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (
          !confirm(
            "Delete this question? Questions with existing quiz attempts cannot be deleted.",
          )
        )
          return;
        try {
          const { error } = await db.rpc("admin_delete_quiz_question", {
            p_question_id: question.id,
          });
          if (error) throw error;
          toast("Question deleted from Supabase.");
          await loadQuestions();
        } catch (error) {
          toast(error.message || "Could not delete question.");
        }
      });
      actions.append(edit, remove);
      row.append(statusCell, actions);
      tbody.appendChild(row);
    });
    if (!questions.length) {
      const row = document.createElement("tr");
      const empty = cell("No questions found. Add the first daily question.");
      empty.colSpan = 4;
      row.appendChild(empty);
      tbody.appendChild(row);
    }
  }

  function openQuestionModal(question = null) {
    form.reset();
    $("editQuestionId").value = question?.id || "";
    $("questionModalTitle").textContent = question
      ? "Edit question"
      : "Add a question";
    $("questionScheduleDate").min = todayNepal();
    if (question) {
      $("questionText").value = question.question_text;
      const sorted = [...question.options].sort(
        (a, b) => a.position - b.position,
      );
      ["optionA", "optionB", "optionC", "optionD"].forEach(
        (id, i) => ($(id).value = sorted[i]?.option_text || ""),
      );
      const answerIndex = sorted.findIndex(
        (option) => option.id === question.answerKey?.correct_option_id,
      );
      $("correctAnswer").value = String(answerIndex >= 0 ? answerIndex : 0);
      $("questionExplanation").value = question.answerKey?.explanation || "";
      const assignment = question.assignments.find((a) => a.is_published);
      $("questionScheduleDate").value = assignment?.quiz_date || "";
      $("questionPublished").checked = Boolean(assignment);
    } else {
      $("questionPublished").checked = false;
    }
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeQuestionModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }
  $("addQuestionButton")?.addEventListener("click", () => openQuestionModal());
  $("closeQuestionModal")?.addEventListener("click", closeQuestionModal);
  $("cancelQuestion")?.addEventListener("click", closeQuestionModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeQuestionModal();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const publish = $("questionPublished").checked;
    const quizDate = $("questionScheduleDate").value || null;
    if (publish && !quizDate) {
      toast("Choose a Nepal date before publishing.");
      return;
    }
    const options = ["optionA", "optionB", "optionC", "optionD"].map((id) =>
      $(id).value.trim(),
    );
    if (options.some((option) => !option)) {
      toast("Please fill all four answer options.");
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Saving…";
    try {
      const { error } = await db.rpc("admin_save_quiz_question", {
        p_question_id: $("editQuestionId").value || null,
        p_question_text: $("questionText").value.trim(),
        p_options: options,
        p_correct_position: Number($("correctAnswer").value) + 1,
        p_explanation: $("questionExplanation").value.trim(),
        p_quiz_date: quizDate,
        p_publish: publish,
      });
      if (error) throw error;
      closeQuestionModal();
      toast(
        publish
          ? "Question saved and scheduled."
          : "Question saved as a draft.",
      );
      await loadQuestions();
    } catch (error) {
      toast(error.message || "Could not save the question.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Save question";
    }
  });

  /* =========================================================
   NEPAL PREDICTION MANAGEMENT
========================================================= */

  function predictionMessage(message, error = false) {
    const node = $("predictionAdminMessage");
    if (!node) return;

    node.textContent = message;
    node.style.color = error ? "var(--a-red)" : "var(--a-muted)";
  }

  async function loadPredictions() {
    const container = $("predictionRoundList");
    if (!container || !db) return;

    container.textContent = "Loading prediction rounds…";

    // Close rounds whose deadlines have passed.
    const { error: closeError } = await db.rpc(
      "close_expired_prediction_rounds",
    );

    if (closeError) throw closeError;

    const { data: rounds, error } = await db
      .from("prediction_rounds")
      .select(
        `
      id,
      metal,
      provider_symbol,
      quote_currency,
      opening_price,
      settlement_price,
      opened_at,
      closes_at,
      settled_at,
      status
    `,
      )
      .eq("provider", "nepal_admin_rates")
      .order("opened_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    container.replaceChildren();

    if (!rounds.length) {
      const empty = document.createElement("article");
      empty.className = "admin-panel";
      empty.textContent = "No Nepal prediction rounds have been opened yet.";
      container.appendChild(empty);

      $("overviewActivePredictions").textContent = "0";
      return;
    }

    const roundIds = rounds.map((round) => round.id);

    const { data: predictions, error: predictionError } = await db
      .from("predictions")
      .select("id,round_id,choice,is_correct")
      .in("round_id", roundIds);

    if (predictionError) throw predictionError;

    const grouped = new Map();

    (predictions || []).forEach((prediction) => {
      if (!grouped.has(prediction.round_id)) {
        grouped.set(prediction.round_id, []);
      }

      grouped.get(prediction.round_id).push(prediction);
    });

    let activeCount = 0;

    rounds.forEach((round) => {
      const votes = grouped.get(round.id) || [];
      const higher = votes.filter((v) => v.choice === "higher").length;
      const lower = votes.filter((v) => v.choice === "lower").length;

      if (round.status === "open") activeCount++;

      const card = document.createElement("article");
      card.className = "admin-panel prediction-admin-card";

      const heading = document.createElement("div");
      heading.className = "panel-heading";

      const title = document.createElement("div");

      const name = document.createElement("h3");
      name.textContent =
        round.metal.charAt(0).toUpperCase() + round.metal.slice(1);

      const subtitle = document.createElement("small");
      subtitle.textContent = round.provider_symbol;

      title.append(name, subtitle);

      const status = document.createElement("span");
      status.className =
        "status-chip " +
        (round.status === "settled"
          ? "approved"
          : round.status === "open"
            ? "pending"
            : "rejected");

      status.textContent = round.status.toUpperCase();

      heading.append(title, status);

      const details = document.createElement("div");
      details.className = "prediction-admin-details";

      const rows = [
        ["Opening rate", formatNPR(round.opening_price)],
        [
          "Closing rate",
          round.settlement_price
            ? formatNPR(round.settlement_price)
            : "Not settled",
        ],
        ["Opened", formatNepalDateTime(round.opened_at)],
        ["Deadline", formatNepalDateTime(round.closes_at)],
        ["Total predictions", String(votes.length)],
        ["Higher", String(higher)],
        ["Lower", String(lower)],
      ];

      rows.forEach(([label, value]) => {
        const item = document.createElement("div");
        const key = document.createElement("span");
        const val = document.createElement("strong");

        key.textContent = label;
        val.textContent = value;

        item.append(key, val);
        details.appendChild(item);
      });

      card.append(heading, details);

      if (round.status === "closed") {
        const settlementForm = document.createElement("form");
        settlementForm.className = "prediction-settlement-form";

        const label = document.createElement("label");
        label.textContent = "Verified closing rate (NPR per tola)";

        const input = document.createElement("input");
        input.type = "number";
        input.min = "0.01";
        input.step = "0.01";
        input.required = true;
        input.placeholder = "Enter verified published rate";

        const button = document.createElement("button");
        button.type = "submit";
        button.className = "admin-primary-button";
        button.textContent = "Settle this round";

        label.appendChild(input);
        settlementForm.append(label, button);

        settlementForm.addEventListener("submit", async (event) => {
          event.preventDefault();

          const price = Number(input.value);

          if (!Number.isFinite(price) || price <= 0) {
            toast("Enter a valid closing rate.");
            return;
          }

          const confirmed = confirm(
            `Settle ${round.metal} at ${formatNPR(price)}? This action records the final result.`,
          );

          if (!confirmed) return;

          button.disabled = true;
          button.textContent = "Settling…";

          try {
            const { error: settleError } = await db.rpc(
              "settle_prediction_round",
              {
                p_round_id: round.id,
                p_settlement_price: price,
              },
            );

            if (settleError) throw settleError;

            toast(`${round.metal} round settled successfully.`);
            await loadPredictions();
          } catch (error) {
            toast(error.message || "Could not settle this round.");
            button.disabled = false;
            button.textContent = "Settle this round";
          }
        });

        card.appendChild(settlementForm);
      }

      if (round.status === "settled") {
        const result = document.createElement("p");
        result.className = "prediction-result-note";

        if (Number(round.settlement_price) === Number(round.opening_price)) {
          result.textContent = "Result: Tie — no direction was correct.";
        } else {
          result.textContent = `Result: ${
            Number(round.settlement_price) > Number(round.opening_price)
              ? "Higher"
              : "Lower"
          }`;
        }

        card.appendChild(result);
      }

      container.appendChild(card);
    });

    $("overviewActivePredictions").textContent = String(activeCount);
  }

  /* OPEN TODAY'S TWO NEPAL ROUNDS */

  $("openNepalRoundsForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!adminVerified) {
      toast("Administrator access is required.");
      return;
    }

    const input = $("predictionClosesAt");
    const button = $("openNepalRoundsButton");

    if (!input.value) {
      predictionMessage("Choose a deadline first.", true);
      return;
    }

    // datetime-local is interpreted explicitly as Nepal time (UTC+05:45).
    const closesAt = new Date(`${input.value}:00+05:45`);

    if (!Number.isFinite(closesAt.getTime()) || closesAt <= new Date()) {
      predictionMessage("The deadline must be in the future.", true);
      return;
    }

    if (
      !confirm(
        "Open both gold and silver rounds using today’s published Nepal rates?",
      )
    )
      return;

    button.disabled = true;
    button.textContent = "Opening rounds…";

    try {
      const { data, error } = await db.rpc(
        "admin_open_nepal_prediction_rounds",
        { p_closes_at: closesAt.toISOString() },
      );

      if (error) throw error;

      predictionMessage(
        `Successfully opened ${data.length} Nepal prediction rounds.`,
      );

      toast("Gold and silver rounds are now open.");
      await loadPredictions();
    } catch (error) {
      predictionMessage(error.message || "Could not open rounds.", true);
    } finally {
      button.disabled = false;
      button.textContent = "Open gold & silver rounds";
    }
  });

  $("refreshPredictionsButton")?.addEventListener("click", () => {
    loadPredictions().catch((error) => toast(error.message));
  });

  /* =========================================================
   PREDICTION COMMENT MODERATION
========================================================= */

  async function loadComments() {
    const container = $("commentList");
    if (!container || !db) return;

    container.textContent = "Loading comments…";

    const { data: comments, error } = await db
      .from("prediction_comments")
      .select(
        `
      id,
      prediction_id,
      user_id,
      comment_text,
      status,
      created_at
    `,
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    container.replaceChildren();

    const pendingCount = comments.filter(
      (comment) => comment.status === "pending",
    ).length;

    $("commentCount").textContent =
      `${comments.length} comments · ${pendingCount} pending`;

    $("overviewPendingComments").textContent = String(pendingCount);
    $("pendingNavCount").textContent = String(pendingCount);

    if (!comments.length) {
      const empty = document.createElement("article");
      empty.className = "admin-panel";
      empty.textContent = "No prediction comments have been submitted yet.";
      container.appendChild(empty);
      return;
    }

    const predictionIds = [
      ...new Set(comments.map((comment) => comment.prediction_id)),
    ];

    const userIds = [...new Set(comments.map((comment) => comment.user_id))];

    const { data: predictions, error: predictionError } = await db
      .from("predictions")
      .select("id,round_id,choice")
      .in("id", predictionIds);

    if (predictionError) throw predictionError;

    const roundIds = [
      ...new Set(predictions.map((prediction) => prediction.round_id)),
    ];

    const { data: rounds, error: roundError } = await db
      .from("prediction_rounds")
      .select("id,metal,opening_price")
      .in("id", roundIds);

    if (roundError) throw roundError;

    // Profile names are optional; IDs remain available as a fallback.
    const { data: profiles } = await db
      .from("profiles")
      .select("id,display_name")
      .in("id", userIds);

    const predictionMap = new Map(predictions.map((item) => [item.id, item]));

    const roundMap = new Map(rounds.map((item) => [item.id, item]));

    const profileMap = new Map(
      (profiles || []).map((item) => [item.id, item.display_name]),
    );

    comments.forEach((comment) => {
      const prediction = predictionMap.get(comment.prediction_id);
      const round = prediction ? roundMap.get(prediction.round_id) : null;

      const card = document.createElement("article");
      card.className = "comment-card";

      const top = document.createElement("div");
      top.className = "comment-card-top";

      const identity = document.createElement("div");

      const username = document.createElement("strong");
      username.textContent =
        profileMap.get(comment.user_id) || "Registered member";

      const metadata = document.createElement("small");
      metadata.textContent = `${round?.metal || "Metal"} · ${prediction?.choice || "Prediction"} · ${formatNepalDateTime(comment.created_at)}`;

      identity.append(username, metadata);

      const status = document.createElement("span");
      status.className =
        "status-chip " +
        (comment.status === "approved"
          ? "approved"
          : comment.status === "rejected" || comment.status === "hidden"
            ? "rejected"
            : "pending");

      status.textContent = comment.status.toUpperCase();

      top.append(identity, status);

      const message = document.createElement("p");
      message.textContent = comment.comment_text;

      const actions = document.createElement("div");
      actions.className = "comment-card-actions";

      if (comment.status !== "approved") {
        const approve = document.createElement("button");
        approve.className = "admin-primary-button";
        approve.textContent = "Approve";

        approve.addEventListener("click", () =>
          moderateComment(comment.id, "approved"),
        );

        actions.appendChild(approve);
      }

      if (comment.status !== "rejected") {
        const reject = document.createElement("button");
        reject.className = "admin-secondary-button";
        reject.textContent = "Reject";

        reject.addEventListener("click", () =>
          moderateComment(comment.id, "rejected"),
        );

        actions.appendChild(reject);
      }

      if (comment.status === "approved") {
        const hide = document.createElement("button");
        hide.className = "admin-secondary-button";
        hide.textContent = "Hide";

        hide.addEventListener("click", () =>
          moderateComment(comment.id, "hidden"),
        );

        actions.appendChild(hide);
      }

      card.append(top, message, actions);
      container.appendChild(card);
    });
  }

  async function moderateComment(commentId, status) {
    if (!adminVerified) return;

    try {
      const { error } = await db.rpc("moderate_prediction_comment", {
        p_comment_id: commentId,
        p_new_status: status,
      });

      if (error) throw error;

      toast(`Comment ${status}.`);
      await loadComments();
    } catch (error) {
      toast(error.message || "Comment moderation failed.");
    }
  }

  $("refreshCommentsButton")?.addEventListener("click", () => {
    loadComments().catch((error) => toast(error.message));
  });




  async function loadPlatformHealth() {
    if (!db || !adminVerified) return;

    const marketNode = $("internationalCacheHealth");
    if (marketNode) {
      const { data, error } = await db
        .from("market_price_cache")
        .select("fetched_at,is_stale")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        marketNode.textContent = "● Unavailable";
        marketNode.className = "health-pending";
      } else if (!data) {
        marketNode.textContent = "● No price data";
        marketNode.className = "health-pending";
      } else {
        const age = Date.now() - new Date(data.fetched_at).getTime();
        const stale = data.is_stale || age > 90 * 60 * 1000;
        marketNode.textContent = stale ? "● Stale data" : "● Connected";
        marketNode.className = stale ? "health-pending" : "health-ok";
      }
    }

    const editorialNode = $("editorialHealth");
    if (editorialNode) {
      const { count, error } = await db
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("status", "published");
      if (error) {
        editorialNode.textContent = "● Unavailable";
        editorialNode.className = "health-pending";
      } else {
        editorialNode.textContent = `● ${count || 0} published`;
        editorialNode.className = count ? "health-ok" : "health-pending";
      }
    }
  }

  /* =========================================================
     LIVE READ-ONLY USER DIRECTORY
     ========================================================= */

  async function loadUsers() {
    const tbody = $("userDirectory");
    if (!tbody || !db || !adminVerified) return;
    tbody.innerHTML = '<tr><td colspan="5">Loading registered members…</td></tr>';

    const [profilesResult, statsResult] = await Promise.all([
      db.from("profiles").select("id,display_name,username,created_at").order("created_at", { ascending: false }).limit(200),
      db.from("user_stats").select("user_id,total_points,total_quiz_attempts,current_streak"),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (statsResult.error) throw statsResult.error;

    const stats = new Map((statsResult.data || []).map((item) => [item.user_id, item]));
    const profiles = profilesResult.data || [];
    $("userDirectoryCount").textContent = `${profiles.length} members`;
    tbody.replaceChildren();

    if (!profiles.length) {
      const row = document.createElement("tr");
      const cellNode = document.createElement("td");
      cellNode.colSpan = 5;
      cellNode.textContent = "No registered members yet.";
      row.appendChild(cellNode);
      tbody.appendChild(row);
      return;
    }

    profiles.forEach((profile) => {
      const stat = stats.get(profile.id) || {};
      const row = document.createElement("tr");
      const member = document.createElement("td");
      const memberName = document.createElement("strong");
      memberName.textContent = profile.display_name || profile.username || "Member";
      const username = document.createElement("small");
      username.textContent = profile.username ? `@${profile.username}` : "Registered member";
      member.append(memberName, document.createElement("br"), username);
      row.append(
        member,
        cell(profile.created_at ? formatNepalDate(profile.created_at.slice(0, 10)) : "—"),
        cell(Number(stat.total_points || 0).toLocaleString()),
        cell(Number(stat.total_quiz_attempts || 0).toLocaleString()),
        cell(`${Number(stat.current_streak || 0)} days`),
      );
      tbody.appendChild(row);
    });
  }

  /* =========================================================
     LIVE BADGE CATALOGUE AND EARNED COUNTS
     ========================================================= */

  async function loadRewards() {
    const container = $("rewardBadgeList");
    if (!container || !db || !adminVerified) return;
    container.textContent = "Loading badge definitions…";

    const [badgesResult, earnedResult] = await Promise.all([
      db.from("badges").select("id,code,name,description,icon,is_active").order("name"),
      db.from("user_badges").select("badge_id"),
    ]);
    if (badgesResult.error) throw badgesResult.error;
    if (earnedResult.error) throw earnedResult.error;

    const counts = new Map();
    (earnedResult.data || []).forEach((item) => {
      counts.set(item.badge_id, (counts.get(item.badge_id) || 0) + 1);
    });
    container.replaceChildren();

    if (!badgesResult.data?.length) {
      container.textContent = "No badge definitions are configured.";
      return;
    }

    badgesResult.data.forEach((badge) => {
      const card = document.createElement("article");
      card.className = "badge-card";
      const icon = document.createElement("span");
      icon.textContent = badge.icon || "✦";
      const name = document.createElement("strong");
      name.textContent = badge.name;
      const description = document.createElement("small");
      description.textContent = badge.description || "No description provided.";
      const earned = document.createElement("b");
      earned.textContent = `${counts.get(badge.id) || 0} members earned`;
      const status = document.createElement("small");
      status.textContent = badge.is_active ? "ACTIVE" : "INACTIVE";
      status.className = badge.is_active ? "badge-live-status" : "badge-inactive-status";
      card.append(icon, name, description, earned, status);
      container.appendChild(card);
    });
  }

  $("refreshUsersButton")?.addEventListener("click", () => {
    loadUsers().catch((error) => toast(error.message));
  });
  $("refreshRewardsButton")?.addEventListener("click", () => {
    loadRewards().catch((error) => toast(error.message));
  });

  /* =========================================================
     EDITORIAL CMS
     ========================================================= */

  let editorialRows = [];
  let editorialCategories = [];

  function slugifyArticle(value) {
    return String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 250);
  }

  function setArticleMessage(message, isError = false) {
    const node = $("articleFormMessage");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error", isError);
  }

  function resetArticleEditor() {
    $("articleForm")?.reset();
    $("articleId").value = "";
    $("articleEditorHeading").textContent = "Create an article";
    $("articleEditorStatus").textContent = "DRAFT";
    $("articleSlug").dataset.manual = "false";
    setArticleMessage("");
  }

  async function loadEditorialData() {
    const container = $("adminArticleList");
    if (!container || !db || !adminVerified) return;
    container.textContent = "Loading editorial content…";

    const [categoryResult, articleResult] = await Promise.all([
      db.from("article_categories").select("id,name,slug").order("name"),
      db.from("articles")
        .select("id,title,slug,excerpt,body,featured_image_url,status,published_at,updated_at,category_id,article_categories(name)")
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

    if (categoryResult.error) throw categoryResult.error;
    if (articleResult.error) throw articleResult.error;

    editorialCategories = categoryResult.data || [];
    editorialRows = articleResult.data || [];

    const select = $("articleCategory");
    if (select) {
      const selected = select.value;
      select.replaceChildren();
      editorialCategories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
      });
      if (selected && editorialCategories.some((item) => item.id === selected)) {
        select.value = selected;
      }
    }

    container.replaceChildren();
    if (!editorialRows.length) {
      const empty = document.createElement("p");
      empty.textContent = "No articles yet. Create the first editorial story above.";
      container.appendChild(empty);
      return;
    }

    editorialRows.forEach((article) => {
      const row = document.createElement("article");
      row.className = "admin-article-row";

      const copy = document.createElement("div");
      copy.className = "admin-article-copy";
      const title = document.createElement("strong");
      title.textContent = article.title;
      const category = Array.isArray(article.article_categories)
        ? article.article_categories[0]?.name
        : article.article_categories?.name;
      const meta = document.createElement("small");
      meta.textContent = `${category || "Uncategorised"} · ${article.status.toUpperCase()} · Updated ${formatNepalDateTime(article.updated_at)}`;
      copy.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "admin-article-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "admin-secondary-button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => editArticle(article.id));
      actions.appendChild(editButton);

      row.append(copy, actions);
      container.appendChild(row);
    });
  }

  function editArticle(articleId) {
    const article = editorialRows.find((item) => item.id === articleId);
    if (!article) return;
    $("articleId").value = article.id;
    $("articleTitle").value = article.title || "";
    $("articleSlug").value = article.slug || "";
    $("articleSlug").dataset.manual = "true";
    $("articleCategory").value = article.category_id || "";
    $("articleImage").value = article.featured_image_url || "";
    $("articleExcerpt").value = article.excerpt || "";
    $("articleBody").value = article.body || "";
    $("articleEditorHeading").textContent = "Edit article";
    $("articleEditorStatus").textContent = article.status.toUpperCase();
    setArticleMessage(`Editing "${article.title}".`);
    $("articleForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveArticle(publish = false) {
    if (!adminVerified || !db) throw new Error("Administrator access is required.");
    const title = $("articleTitle").value.trim();
    const slug = $("articleSlug").value.trim() || slugifyArticle(title);
    const categoryId = $("articleCategory").value || null;
    const imageUrl = $("articleImage").value.trim() || null;
    const excerpt = $("articleExcerpt").value.trim() || null;
    const body = $("articleBody").value.trim();
    const articleId = $("articleId").value || null;

    if (!title || !slug || !body) throw new Error("Title, URL slug and article body are required.");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("Use a URL slug with lowercase letters, numbers and hyphens only.");
    }
    if (!categoryId) throw new Error("Choose an article category.");
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      throw new Error("Featured image must use an http or https URL.");
    }

    const { data: userData } = await db.auth.getUser();
    const payload = {
      title,
      slug,
      category_id: categoryId,
      featured_image_url: imageUrl,
      excerpt,
      body,
      status: "draft",
      published_at: null,
      updated_at: new Date().toISOString(),
    };

    let savedId = articleId;
    if (articleId) {
      const { error } = await db.from("articles").update(payload).eq("id", articleId);
      if (error) throw error;
    } else {
      const { data, error } = await db.from("articles")
        .insert({ ...payload, author_id: userData?.user?.id || null })
        .select("id")
        .single();
      if (error) throw error;
      savedId = data.id;
    }

    if (publish) {
      const { error } = await db.rpc("publish_article", { p_article_id: savedId });
      if (error) throw error;
    }

    await loadEditorialData();
    const savedArticle = editorialRows.find((item) => item.id === savedId);
    $("articleId").value = savedId;
    $("articleEditorHeading").textContent = "Edit article";
    $("articleEditorStatus").textContent = publish ? "PUBLISHED" : "DRAFT";
    setArticleMessage(publish
      ? "Article published. It is now available in the public journal."
      : "Draft saved. It is not visible to public visitors yet.");
    if (savedArticle) $("articleEditorStatus").textContent = savedArticle.status.toUpperCase();
  }

  $("articleTitle")?.addEventListener("input", () => {
    const slug = $("articleSlug");
    if (slug && slug.dataset.manual !== "true") {
      slug.value = slugifyArticle($("articleTitle").value);
    }
  });
  $("articleSlug")?.addEventListener("input", (event) => {
    event.currentTarget.dataset.manual = "true";
  });
  $("articleForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("saveArticleDraft");
    button.disabled = true;
    try {
      await saveArticle(false);
    } catch (error) {
      setArticleMessage(error.message || "Draft could not be saved.", true);
      toast(error.message || "Draft could not be saved.");
    } finally {
      button.disabled = false;
    }
  });
  $("publishArticleButton")?.addEventListener("click", async () => {
    const button = $("publishArticleButton");
    button.disabled = true;
    try {
      await saveArticle(true);
    } catch (error) {
      setArticleMessage(error.message || "Article could not be published.", true);
      toast(error.message || "Article could not be published.");
    } finally {
      button.disabled = false;
    }
  });
  $("resetArticleForm")?.addEventListener("click", resetArticleEditor);
  $("newArticleButton")?.addEventListener("click", () => {
    resetArticleEditor();
    $("articleForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("refreshArticlesButton")?.addEventListener("click", () => {
    loadEditorialData().catch((error) => toast(error.message));
  });


  /* ---------------------------------------------------------
     FACEBOOK PAGE IMPORT + WEBSITE MODERATION
     This is intentionally independent from the Articles CMS.
     --------------------------------------------------------- */
  let facebookPosts = [];
  let facebookBusy = false;

  function showFacebookMessage(message, isError = false) {
    const node = $("facebookAdminMessage");
    if (node) {
      node.textContent = message || "";
      node.classList.toggle("error", Boolean(isError));
    }
  }

  function formatNepalDateTime(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat("en-NP", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu",
    }).format(date) + " NPT";
  }

  async function loadFacebookStats() {
    const { data, error } = await db.rpc("admin_facebook_publication_stats");
    if (error) throw error;
    const stats = Array.isArray(data) ? data[0] : data;
    if (!stats) throw new Error("Facebook publishing statistics returned no data.");
    $("facebookPublishedToday").textContent = `${stats.published_today} / ${stats.daily_limit}`;
    $("facebookRemainingToday").textContent = String(stats.remaining_today);
    $("facebookPublishedDate").textContent = `Nepal date: ${stats.nepal_date}`;
    const count = Number(stats.published_today);
    $("facebookPublishedToday").classList.toggle("facebook-limit-reached", count >= Number(stats.daily_limit));
  }

  async function loadFacebookPosts() {
    const list = $("facebookAdminList");
    if (!list) return;
    list.textContent = "Loading Facebook posts…";
    const [{ data, error }, pendingResult, totalResult] = await Promise.all([
      db.from("facebook_posts")
        .select("id, facebook_post_id, message, permalink_url, image_url, media_type, source_created_at, imported_at, review_status, reviewed_at, review_note")
        .order("source_created_at", { ascending: false, nullsFirst: false })
        .order("imported_at", { ascending: false })
        .limit(200),
      db.from("facebook_posts").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
      db.from("facebook_posts").select("id", { count: "exact", head: true }),
    ]);
    if (error) throw error;
    if (pendingResult.error) throw pendingResult.error;
    if (totalResult.error) throw totalResult.error;
    facebookPosts = data || [];
    const pending = pendingResult.count ?? 0;
    $("facebookPendingCount").textContent = pending.toLocaleString();
    $("facebookTotalCount").textContent = (totalResult.count ?? 0).toLocaleString();
    $("facebookPendingNavCount").textContent = pending > 99 ? "99+" : String(pending);
    renderFacebookPosts();
  }

  function renderFacebookPosts() {
    const list = $("facebookAdminList");
    if (!list) return;
    const filter = $("facebookStatusFilter")?.value || "pending";
    const visible = filter === "all" ? facebookPosts : facebookPosts.filter((post) => post.review_status === filter);
    $("facebookListSummary").textContent = `${visible.length} ${filter === "all" ? "imported" : filter} post${visible.length === 1 ? "" : "s"} shown · latest 200 records`;
    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "facebook-empty-state";
      empty.textContent = filter === "pending" ? "No pending Facebook posts. Sync the Page to check for new content." : "No posts found for this filter.";
      list.appendChild(empty);
      return;
    }
    visible.forEach((post) => {
      const card = document.createElement("article");
      card.className = "facebook-post-card";
      const body = document.createElement("div"); body.className = "facebook-post-body";
      const top = document.createElement("div"); top.className = "facebook-post-top";
      const status = document.createElement("span"); status.className = `facebook-status-chip ${post.review_status || "pending"}`; status.textContent = (post.review_status || "pending").replace("_", " ").toUpperCase();
      const date = document.createElement("time"); date.textContent = formatNepalDateTime(post.source_created_at || post.imported_at);
      top.append(status, date);
      const message = document.createElement("p"); message.className = "facebook-post-message"; message.textContent = post.message || "This Facebook post has no text. Check its media or original post.";
      body.append(top, message);
      if (post.review_note) { const note = document.createElement("small"); note.className = "facebook-review-note"; note.textContent = `Review note: ${post.review_note}`; body.append(note); }
      const actions = document.createElement("div"); actions.className = "facebook-post-actions";
      if (post.permalink_url) { const link = document.createElement("a"); link.href = post.permalink_url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.className = "admin-secondary-button facebook-source-link"; link.textContent = "View Facebook post ↗"; actions.append(link); }
      if (post.review_status !== "approved") actions.append(makeFacebookAction("Approve & publish", "approved", post.id, "primary"));
      if (post.review_status !== "rejected") actions.append(makeFacebookAction("Reject", "rejected", post.id));
      if (post.review_status !== "hidden") actions.append(makeFacebookAction("Hide", "hidden", post.id));
      if (post.review_status !== "pending") actions.append(makeFacebookAction("Return to pending", "pending", post.id));
      card.append(body);
      if (post.image_url) { const media = document.createElement("a"); media.href = post.image_url; media.target = "_blank"; media.rel = "noopener noreferrer"; media.className = "facebook-post-media-link"; const image = document.createElement("img"); image.src = post.image_url; image.alt = "Image attached to Facebook post"; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; media.append(image); card.insertBefore(media, body); }
      card.append(actions); list.appendChild(card);
    });
  }

  function makeFacebookAction(label, status, postId, variant = "") {
    const button = document.createElement("button");
    button.type = "button"; button.className = variant === "primary" ? "admin-primary-button" : "admin-secondary-button"; button.textContent = label;
    button.addEventListener("click", () => moderateFacebookPost(postId, status, button));
    return button;
  }

  async function moderateFacebookPost(postId, status, button) {
    if (!adminVerified || facebookBusy) return;
    const post = facebookPosts.find((item) => item.id === postId);
    if (!post) return;
    if (status === "approved" && !window.confirm("Publish this Facebook post on the website? This uses one of today's five publishing slots.")) return;
    facebookBusy = true; button.disabled = true; showFacebookMessage("Saving moderation decision…");
    try {
      const { data: userData, error: userError } = await db.auth.getUser();
      if (userError) throw userError;
      const { error } = await db.from("facebook_posts").update({
        review_status: status, reviewed_by: userData.user?.id || null, reviewed_at: new Date().toISOString(),
      }).eq("id", postId);
      if (error) {
        const message = error.message || "Could not update the Facebook post.";
        if (message.includes("Daily website publishing limit reached") || message.includes("P0001")) throw new Error("Today's five-post website publishing limit has been reached. This post remains saved and can stay pending until tomorrow.");
        throw error;
      }
      showFacebookMessage(status === "approved" ? "Post approved and published on the website." : `Post status changed to ${status}.`);
      await Promise.all([loadFacebookStats(), loadFacebookPosts()]);
      await loadOverviewData();
    } catch (error) {
      showFacebookMessage(error.message || "Moderation failed.", true);
      toast(error.message || "Moderation failed.");
    } finally { facebookBusy = false; button.disabled = false; }
  }

  async function syncFacebookPosts() {
    if (!adminVerified || facebookBusy) return;
    const button = $("syncFacebookButton"); facebookBusy = true;
    if (button) { button.disabled = true; button.textContent = "Syncing…"; }
    showFacebookMessage("Contacting the secure Facebook sync function…");
    try {
      const { data, error } = await db.functions.invoke("sync-facebook-posts", { body: {} });
      if (error) throw error;
      const fetched = Number(data?.fetched ?? 0); const saved = Number(data?.saved ?? 0);
      showFacebookMessage(`Sync completed. ${fetched} Facebook post(s) fetched; ${saved} record(s) saved or updated. Existing review decisions are preserved.`);
      await Promise.all([loadFacebookStats(), loadFacebookPosts()]);
    } catch (error) {
      console.error("Facebook sync failed:", error);
      showFacebookMessage(error.message || "Facebook sync failed. Check the Edge Function logs and server-side Facebook credentials.", true);
    } finally { facebookBusy = false; if (button) { button.disabled = false; button.textContent = "Sync Facebook posts"; } }
  }

  async function loadFacebookWorkspace() {
    if (!adminVerified || !db) return;
    showFacebookMessage("");
    const results = await Promise.allSettled([loadFacebookStats(), loadFacebookPosts()]);
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      const error = failed[0].reason;
      showFacebookMessage(error?.message || "Some Facebook data could not be loaded. Check the database policies and statistics RPC.", true);
    }
  }

  $("facebookStatusFilter")?.addEventListener("change", renderFacebookPosts);
  $("refreshFacebookButton")?.addEventListener("click", () => loadFacebookWorkspace().catch((error) => showFacebookMessage(error.message, true)));
  $("syncFacebookButton")?.addEventListener("click", syncFacebookPosts);

  async function initialise() {
    if (!db) {
      setAccessMessage(
        "Supabase did not initialise. Confirm that the Supabase CDN and supabase-client.js load before admin.js.",
        "error",
      );
      setAdminControls(false);
      return;
    }
    try {
      await requireAdmin();
      setupNepalRates();

      const tasks = [
        ["Daily quiz", loadQuestions],
        ["Prediction rounds", loadPredictions],
        ["Comment moderation", loadComments],
        ["Editorial manager", loadEditorialData],
        ["User directory", loadUsers],
        ["Rewards catalogue", loadRewards],
        ["Platform health", loadPlatformHealth],
        ["Nepal rates", loadNepalRates],
        ["Overview", loadOverviewData],
        ["Facebook publishing", loadFacebookWorkspace],
      ];

      const results = await Promise.allSettled(
        tasks.map(async ([label, task]) => {
          try {
            await task();
            return label;
          } catch (taskError) {
            console.error(`${label} section could not load:`, taskError);
            toast(`${label} could not load. Check its section for details.`);
            throw taskError;
          }
        }),
      );

      const failed = results.filter((result) => result.status === "rejected").length;
      if (failed) {
        setAccessMessage(
          `Administrator verified. ${failed} dashboard section(s) could not load; other sections remain available.`,
          "success",
        );
      }
    } catch (error) {
      document.querySelector(".demo-status").innerHTML =
        "<i></i> ACCESS REQUIRED";
      adminVerified = false;
      setAccessMessage(
        error.message || "Administrator access could not be verified.",
        "error",
      );
      setAdminControls(false);
      $("quizDatabaseHealth").textContent = "● Access unavailable";
      $("quizDatabaseHealth").className = "health-pending";
    }
  }
  initialise();
});
