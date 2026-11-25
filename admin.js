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

    const [users, predictions] = await Promise.all([
      countRows("profiles"),
      countRows("prediction_rounds", (query) => query.eq("status", "open")),
    ]);

    if (users !== null) {
      setValue("overviewTotalUsers", users.toLocaleString());
    } else {
      setValue("overviewTotalUsers", "Unavailable");
    }

    if (predictions !== null) {
      setValue("overviewActivePredictions", predictions.toLocaleString());
    } else {
      setValue("overviewActivePredictions", "Unavailable");
    }

    // Comment status values need to be verified before counting pending comments.
    setValue("overviewPendingComments", "Not verified");

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
    if (!adminVerified) {
      toast("Administrator permission is required to manage quiz questions.");
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
        predictions: "Market predictions",
        comments: "Comment moderation",
        users: "User management",
        rewards: "Rewards and badges",
      }[name] || "Dashboard overview";
    $("breadcrumbName").textContent = name.toUpperCase();
    $("adminSidebar")?.classList.remove("open");
    if (name === "questions")
      loadQuestions().catch((error) =>
        toast(error.message || "Could not load questions."),
      );
    if (name === "rates") {
      loadNepalRates();
    }
  }

  document.querySelectorAll(".admin-nav-link").forEach((button) => {
    button.addEventListener("click", () => {
      if (
        ["predictions", "comments", "users", "rewards"].includes(
          button.dataset.view,
        )
      ) {
        toast("This section is not connected yet. Daily Quiz is live.");
        return;
      }
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
      await loadNepalRates();
      await loadOverviewData();
      await loadQuestions();
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
