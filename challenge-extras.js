document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const db = window.gnsSupabase;

  const state = {
    user: null,
    rounds: { gold: null, silver: null },
    predictions: { gold: null, silver: null },
    comments: { gold: null, silver: null },
    choices: { gold: null, silver: null },
    loading: false,
  };

  const metalNames = { gold: "Gold", silver: "Silver" };

  function formatNPR(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "Rate unavailable";
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatNepalDateTime(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-NP", {
      timeZone: "Asia/Kathmandu",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function setMessage(metal, message, kind = "") {
    const node = $(`${metal}PredictionMessage`);
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind;
  }

  function openAccountWindow() {
    const modal = $("authModal");
    if (modal) {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("auth-open");
      return;
    }
    $("accountButton")?.click();
  }

  function setChoiceButtons(metal, prediction, accepting) {
    document
      .querySelectorAll(`[data-metal="${metal}"][data-choice]`)
      .forEach((button) => {
        const selected = button.dataset.choice === state.choices[metal];
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.disabled = Boolean(prediction) || !accepting;
      });
  }

  function setCommentForm(metal, prediction, comment) {
    const form = document.querySelector(`[data-comment-form="${metal}"]`);
    const input = document.querySelector(`[data-comment-input="${metal}"]`);
    const message = document.querySelector(`[data-comment-message="${metal}"]`);
    if (!form || !input || !message) return;

    const round = state.rounds[metal];
    const accepting = round &&
      round.status === "open" &&
      new Date(round.closes_at).getTime() > Date.now();

    form.hidden = !(state.user && prediction && accepting);

    if (comment) {
      input.value = comment.comment_text || "";
      input.disabled = true;
      form.querySelector("button[type='submit']").disabled = true;
      message.textContent = `Your comment is ${comment.status}.`;
    } else {
      input.disabled = false;
      form.querySelector("button[type='submit']").disabled = false;
      message.textContent = "Comments are reviewed by the site administrator before appearing publicly.";
    }
  }

  function renderMetal(metal) {
    const round = state.rounds[metal];
    const prediction = state.predictions[metal];
    const comment = state.comments[metal];
    const status = $(`${metal}PredictionStatus`);
    const rate = $(`${metal}PredictionRate`);
    const meta = $(`${metal}PredictionMeta`);
    const submit = document.querySelector(`[data-submit-prediction="${metal}"]`);
    const choices = document.querySelectorAll(`[data-metal="${metal}"][data-choice]`);

    if (!round) {
      if (status) status.textContent = "NO ROUND";
      if (rate) rate.textContent = "Not published";
      if (meta) meta.textContent = "A Nepal prediction round has not been opened yet.";
      choices.forEach((button) => { button.disabled = true; });
      if (submit) {
        submit.disabled = true;
        submit.textContent = state.user ? "No open round available" : "Sign in to participate";
      }
      setMessage(metal, "There is no Nepal prediction round available at the moment.");
      setCommentForm(metal, null, null);
      return;
    }

    const deadlinePassed = new Date(round.closes_at).getTime() <= Date.now();
    const accepting = round.status === "open" && !deadlinePassed;
    if (status) {
      status.textContent = accepting
        ? "OPEN"
        : round.status === "settled"
          ? "SETTLED"
          : deadlinePassed
            ? "DEADLINE PASSED"
            : round.status.toUpperCase();
      status.dataset.status = accepting ? "open" : round.status;
    }
    if (rate) rate.textContent = `${formatNPR(round.opening_price)} / tola`;
    if (meta) {
      meta.textContent = `Opening rate · ${formatNepalDateTime(round.opened_at)} · Deadline ${formatNepalDateTime(round.closes_at)} NPT`;
    }

    setChoiceButtons(metal, prediction, accepting);

    if (submit) {
      submit.disabled = !accepting || Boolean(prediction) || !state.choices[metal];
      submit.textContent = prediction
        ? "Prediction submitted"
        : !accepting
          ? "Predictions are closed"
          : state.user
            ? "Submit prediction ↗"
            : "Sign in to make your prediction ↗";
    }

    if (prediction) {
      const choice = prediction.choice.toUpperCase();
      let result = "Your prediction is recorded. The result will appear after settlement.";
      if (prediction.is_correct === true) result = "Your prediction was correct. Well done!";
      if (prediction.is_correct === false) result = "Your prediction was not correct this time.";
      if (round.status === "settled" && prediction.is_correct === null) result = "This round was tied. No direction was correct.";
      setMessage(metal, `You predicted ${choice}. ${result}`, "success");
    } else if (!accepting) {
      setMessage(metal, "This round is no longer accepting predictions. Results will be shown after administrator settlement.");
    } else if (!state.user) {
      setMessage(metal, "Choose a direction, then sign in to submit. No entry fee; educational and entertainment use only.");
    } else {
      setMessage(metal, "Choose Higher or Lower to submit your prediction.");
    }

    setCommentForm(metal, prediction, comment);
  }

  async function loadApprovedComments() {
    const container = $("approvedPredictionComments");
    if (!container || !db) return;
    container.replaceChildren();

    const { data, error } = await db
      .from("prediction_comments")
      .select("id, comment_text, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      const note = document.createElement("p");
      note.className = "prediction-community-note";
      note.textContent = "Approved community comments are temporarily unavailable.";
      container.appendChild(note);
      console.warn("Approved prediction comments:", error.message);
      return;
    }

    if (!data?.length) {
      const note = document.createElement("p");
      note.className = "prediction-community-note";
      note.textContent = "No approved community comments yet. Be the first to share a thoughtful market observation.";
      container.appendChild(note);
      return;
    }

    data.forEach((item) => {
      const card = document.createElement("article");
      card.className = "prediction-comment-card";
      const quote = document.createElement("p");
      quote.textContent = item.comment_text;
      const date = document.createElement("time");
      date.textContent = formatNepalDateTime(item.created_at);
      card.append(quote, date);
      container.appendChild(card);
    });
  }

  async function loadChallenge() {
    if (!db) {
      ["gold", "silver"].forEach((metal) => {
        setMessage(metal, "Prediction service is temporarily unavailable.");
      });
      return;
    }

    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) console.warn("Prediction session:", sessionError.message);
    state.user = sessionData?.session?.user || null;

    const { data: rounds, error: roundsError } = await db
      .from("prediction_rounds")
      .select("id, metal, provider_symbol, quote_currency, opening_price, settlement_price, opened_at, closes_at, settled_at, status")
      .eq("provider", "nepal_admin_rates")
      .order("opened_at", { ascending: false })
      .limit(30);

    if (roundsError) {
      console.error("Nepal prediction rounds could not load:", roundsError);
      ["gold", "silver"].forEach((metal) => {
        setMessage(metal, "Nepal prediction rounds could not be loaded. Please refresh later.", "error");
      });
      return;
    }

    state.rounds = { gold: null, silver: null };
    (rounds || []).forEach((round) => {
      if (["gold", "silver"].includes(round.metal) && !state.rounds[round.metal]) {
        state.rounds[round.metal] = round;
      }
    });

    const openCount = Object.values(state.rounds).filter((round) =>
      round && round.status === "open" && new Date(round.closes_at).getTime() > Date.now()
    ).length;
    const overall = $("predictionOverallStatus");
    if (overall) {
      overall.textContent = openCount === 2
        ? "GOLD & SILVER OPEN"
        : openCount === 1
          ? "ONE ROUND OPEN"
          : "NO OPEN ROUNDS";
    }

    state.predictions = { gold: null, silver: null };
    state.comments = { gold: null, silver: null };

    const roundIds = Object.values(state.rounds).filter(Boolean).map((round) => round.id);
    if (state.user && roundIds.length) {
      const { data: predictions, error: predictionError } = await db
        .from("predictions")
        .select("id, round_id, choice, is_correct, submitted_at")
        .eq("user_id", state.user.id)
        .in("round_id", roundIds);

      if (predictionError) {
        console.error("Your predictions could not load:", predictionError);
      } else {
        (predictions || []).forEach((prediction) => {
          const round = Object.values(state.rounds).find((item) => item?.id === prediction.round_id);
          if (round) state.predictions[round.metal] = prediction;
        });
      }

      const predictionIds = Object.values(state.predictions).filter(Boolean).map((item) => item.id);
      if (predictionIds.length) {
        const { data: comments, error: commentError } = await db
          .from("prediction_comments")
          .select("id, prediction_id, status, comment_text")
          .eq("user_id", state.user.id)
          .in("prediction_id", predictionIds);

        if (commentError) {
          console.warn("Your prediction comments could not load:", commentError.message);
        } else {
          (comments || []).forEach((comment) => {
            const metal = Object.keys(state.predictions).find((key) => state.predictions[key]?.id === comment.prediction_id);
            if (metal) state.comments[metal] = comment;
          });
        }
      }
    }

    ["gold", "silver"].forEach(renderMetal);
    await loadApprovedComments();
  }

  document.querySelectorAll("[data-metal][data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const metal = button.dataset.metal;
      const choice = button.dataset.choice;
      if (!["gold", "silver"].includes(metal) || !["higher", "lower"].includes(choice)) return;
      if (state.predictions[metal]) return;
      const round = state.rounds[metal];
      const accepting = round && round.status === "open" && new Date(round.closes_at).getTime() > Date.now();
      if (!accepting) return;
      state.choices[metal] = choice;
      setChoiceButtons(metal, null, true);
      const submit = document.querySelector(`[data-submit-prediction="${metal}"]`);
      if (submit) {
        submit.disabled = false;
      }
      setMessage(metal, `${choice.toUpperCase()} selected. ${state.user ? "Submit to record your prediction." : "Sign in to submit your prediction."}`);
    });
  });

  document.querySelectorAll("[data-submit-prediction]").forEach((button) => {
    button.addEventListener("click", async () => {
      const metal = button.dataset.submitPrediction;
      if (!["gold", "silver"].includes(metal)) return;
      if (!state.user) {
        openAccountWindow();
        return;
      }
      const round = state.rounds[metal];
      const choice = state.choices[metal];
      if (!round || round.status !== "open" || new Date(round.closes_at).getTime() <= Date.now()) {
        setMessage(metal, "This round is not accepting predictions.");
        return;
      }
      if (!choice) {
        setMessage(metal, "Choose Higher or Lower first.");
        return;
      }

      button.disabled = true;
      button.textContent = "Submitting…";
      try {
        const { data, error } = await db.rpc("submit_prediction", {
          p_round_id: round.id,
          p_choice: choice,
        });
        if (error) throw error;
        setMessage(metal, "Your prediction has been recorded.", "success");
        state.choices[metal] = null;
        await loadChallenge();
      } catch (error) {
        const message = error?.message || "Your prediction could not be submitted.";
        setMessage(metal, message, "error");
        await loadChallenge();
      }
    });
  });

  document.querySelectorAll("[data-comment-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const metal = form.dataset.commentForm;
      const prediction = state.predictions[metal];
      const input = form.querySelector("[data-comment-input]");
      const message = form.querySelector("[data-comment-message]");
      const button = form.querySelector("button[type='submit']");
      const commentText = input?.value.trim() || "";

      if (!state.user) {
        openAccountWindow();
        return;
      }
      if (!prediction) {
        if (message) message.textContent = "Submit a prediction before commenting.";
        return;
      }
      if (commentText.length < 1 || commentText.length > 1000) {
        if (message) message.textContent = "Write between 1 and 1,000 characters.";
        return;
      }

      button.disabled = true;
      button.textContent = "Sending…";
      try {
        const { error } = await db.rpc("submit_prediction_comment", {
          p_prediction_id: prediction.id,
          p_comment_text: commentText,
        });
        if (error) throw error;
        if (message) message.textContent = "Comment submitted for administrator review.";
        await loadChallenge();
      } catch (error) {
        if (message) message.textContent = error?.message || "Comment could not be submitted.";
        button.disabled = false;
        button.textContent = "Submit for review";
      }
    });
  });

  async function renderLeaderboard(period = "monthly") {
    const container = $("leaderboardList");
    if (!container || !db) return;
    container.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "leaderboard-footnote";
    loading.textContent = "Loading live rankings…";
    container.appendChild(loading);

    const { data, error } = await db.rpc("get_quiz_leaderboard", {
      p_period: period === "alltime" ? "all_time" : "monthly",
      p_limit: 10,
    });

    container.replaceChildren();
    if (error) {
      const note = document.createElement("p");
      note.className = "leaderboard-footnote";
      note.textContent = "Live rankings could not be loaded. Please try again later.";
      container.appendChild(note);
      console.warn("Leaderboard:", error.message);
      return;
    }
    if (!data?.length) {
      const note = document.createElement("p");
      note.className = "leaderboard-footnote";
      note.textContent = "No public rankings yet. Members can opt in and start playing.";
      container.appendChild(note);
      return;
    }

    data.forEach((person) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row";
      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = String(person.rank).padStart(2, "0");
      const user = document.createElement("div");
      user.className = "leaderboard-user";
      const name = document.createElement("strong");
      name.textContent = person.username || person.display_name || "Member";
      const detail = document.createElement("small");
      detail.textContent = `${Number(person.correct_answers || 0)} correct answers`;
      user.append(name, detail);
      const score = document.createElement("span");
      score.className = "leaderboard-score";
      score.textContent = `${Number(person.points || 0).toLocaleString()} pts`;
      row.append(rank, user, score);
      container.appendChild(row);
    });
  }

  async function updateAchievements() {
    const cards = [...document.querySelectorAll("[data-badge]")];
    if (!cards.length || !db) return;
    const { data: sessionData } = await db.auth.getSession();
    const user = sessionData?.session?.user || null;

    if (!user) {
      cards.forEach((card) => {
        card.classList.remove("unlocked");
        const stateNode = card.querySelector(".achievement-state");
        if (stateNode) stateNode.textContent = "SIGN IN";
      });
      return;
    }

    const { data, error } = await db
      .from("user_badges")
      .select("badge_id,badges(code)")
      .eq("user_id", user.id);

    if (error) {
      console.warn("Achievements could not load:", error.message);
      return;
    }

    const unlocked = new Set((data || []).map((item) => item.badges?.code).filter(Boolean));
    const codes = { streak7: "streak_7", streak30: "streak_30", correct100: "correct_100" };
    cards.forEach((card) => {
      const isUnlocked = unlocked.has(codes[card.dataset.badge]);
      card.classList.toggle("unlocked", isUnlocked);
      const stateNode = card.querySelector(".achievement-state");
      if (stateNode) stateNode.textContent = isUnlocked ? "UNLOCKED" : "LOCKED";
    });
  }

  async function loadLeaderboardPreference() {
    const checkbox = $("leaderboardOptIn");
    const message = $("leaderboardOptInMessage");
    if (!checkbox || !db) return;
    const { data: sessionData } = await db.auth.getSession();
    const user = sessionData?.session?.user || null;
    state.user = user;

    if (!user) {
      checkbox.checked = false;
      checkbox.disabled = true;
      if (message) message.textContent = "Sign in to choose whether your display name appears on the public leaderboard.";
      return;
    }

    const { data, error } = await db
      .from("profiles")
      .select("leaderboard_opt_in")
      .eq("id", user.id)
      .maybeSingle();

    checkbox.disabled = false;
    if (error) {
      if (message) message.textContent = "Your leaderboard preference could not be loaded.";
      console.warn("Leaderboard preference:", error.message);
      return;
    }
    checkbox.checked = Boolean(data?.leaderboard_opt_in);
    if (message) message.textContent = checkbox.checked
      ? "Your display name and quiz score are visible on the public leaderboard."
      : "Your score stays off the public leaderboard until you opt in.";
  }

  $("leaderboardOptIn")?.addEventListener("change", async (event) => {
    const checkbox = event.currentTarget;
    const message = $("leaderboardOptInMessage");
    if (!state.user) {
      checkbox.checked = false;
      openAccountWindow();
      return;
    }
    checkbox.disabled = true;
    const { error } = await db.rpc("set_leaderboard_visibility", {
      p_opt_in: checkbox.checked,
    });
    checkbox.disabled = false;
    if (error) {
      checkbox.checked = !checkbox.checked;
      if (message) message.textContent = error.message || "Preference could not be saved.";
      return;
    }
    if (message) message.textContent = checkbox.checked
      ? "You are now visible on the public leaderboard."
      : "You have been removed from the public leaderboard.";
    const active = document.querySelector("[data-leaderboard].active")?.dataset.leaderboard || "monthly";
    await renderLeaderboard(active);
  });

  document.querySelectorAll("[data-leaderboard]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-leaderboard]").forEach((tab) => {
        tab.classList.toggle("active", tab === button);
      });
      renderLeaderboard(button.dataset.leaderboard);
    });
  });

  document.addEventListener("gns:quiz-updated", () => {
    Promise.resolve().then(updateAchievements);
    Promise.resolve().then(() => renderLeaderboard("monthly"));
  });

  // Supabase auth callbacks must stay synchronous. Defer data requests until after they return.
  db?.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
      Promise.resolve().then(async () => {
        await loadChallenge();
        await updateAchievements();
        await loadLeaderboardPreference();
      });
    }
  });

  renderLeaderboard("monthly");
  loadChallenge();
  updateAchievements();
  loadLeaderboardPreference();
});
  