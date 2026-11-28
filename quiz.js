document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const client = window.gnsSupabase;
  const el = {
    question: $('quizQuestion'), options: $('quizOptions'), submit: $('quizSubmit'),
    quit: $('quizQuit'), feedback: $('quizFeedback'), loginPrompt: $('quizLoginPrompt'),
    date: $('quizDate'), number: $('quizQuestionNumber'), points: $('quizPoints'),
    streak: $('quizStreak'), bell: $('notificationBell'), panel: $('notificationPanel'),
    panelText: $('notificationText'), dot: $('notificationDot'), toast: $('dailyQuizNotice'),
    reminderText: $('dailyQuizNoticeText'), closeNotice: $('closeDailyQuizNotice')
  };
  if (!el.question || !el.options || !el.submit) return;

  const GUEST_TOKEN_KEY = 'gnsQuizGuestTokenV1';
  const REMINDER_KEY = 'gnsQuizReminderShownV1';
  const READ_KEY = 'gnsQuizReminderReadV1';
  let assignment = null;
  let options = [];
  let selectedOptionId = null;
  let guestTokenHash = null;
  let currentUser = null;
  let submitted = false;
  let guestClaimPromise = null;
  let guestClaimedHash = null;

  function nepalDateKey(date = new Date()) {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const v = Object.fromEntries(p.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    return `${v.year}-${v.month}-${v.day}`;
  }

  function formatNepalDate() {
    return new Intl.DateTimeFormat('en-NP', {
      timeZone: 'Asia/Kathmandu', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date());
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function getStoredGuestHash(createIfMissing = true) {
    let token = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!token && createIfMissing) {
      token = crypto.randomUUID();
      localStorage.setItem(GUEST_TOKEN_KEY, token);
    }
    if (!token) return null;
    const hash = await sha256(token);
    if (createIfMissing) {
      const { error } = await client.rpc('create_guest_quiz_session', { p_token_hash: hash });
      if (error) throw error;
    }
    return hash;
  }


  async function claimGuestProgress(hash) {
    if (!hash || !currentUser || !client) return;
    if (guestClaimedHash === hash) return;
    if (guestClaimPromise) return guestClaimPromise;
    guestClaimPromise = (async () => {
      const { error } = await client.rpc('claim_guest_quiz_progress', { p_guest_token_hash: hash });
      if (!error) {
        localStorage.removeItem(GUEST_TOKEN_KEY);
        guestClaimedHash = hash;
        return;
      }
      const message = String(error.message || '').toLowerCase();
      // A stale, expired or already-claimed guest token should not be retried on every page load.
      if (/invalid|expired|already claimed|guest session is invalid/.test(message)) {
        localStorage.removeItem(GUEST_TOKEN_KEY);
        guestClaimedHash = hash;
        console.info('Old guest quiz token cleared; no additional guest progress was available to transfer.');
        return;
      }
      throw error;
    })();
    try { await guestClaimPromise; }
    finally { guestClaimPromise = null; }
  }

  function setMessage(message, type = '') {
    el.feedback.hidden = !message;
    el.feedback.className = `quiz-feedback ${type}`.trim();
    el.feedback.textContent = message;
  }

  function setReminder(message, showToast = false) {
    if (el.panelText) el.panelText.textContent = message;
    if (el.reminderText) el.reminderText.textContent = message;
    if (el.dot) el.dot.hidden = localStorage.getItem(READ_KEY) === nepalDateKey();
    if (showToast && el.toast) {
      el.toast.hidden = false;
      window.setTimeout(() => { if (el.toast) el.toast.hidden = true; }, 6500);
    }
  }

  function updateStats(stats = {}) {
    if (el.points) el.points.textContent = Number(stats.total_points || 0).toLocaleString();
    if (el.streak) {
      const streak = Number(stats.current_streak || 0);
      el.streak.textContent = String(streak);r
    }
    document.dispatchEvent(new CustomEvent('gns:quiz-updated', { detail: { stats } }));
  }

  async function loadStats() {
    if (!client) return;
    if (currentUser) {
      const { data, error } = await client.from('user_stats').select('total_points,total_quiz_attempts,correct_answers,current_streak,longest_streak').eq('user_id', currentUser.id).maybeSingle();
      if (error) throw error;
      updateStats(data || {});
    } else {
      const { data, error } = await client.rpc('get_guest_quiz_stats', { p_guest_token_hash: guestTokenHash });
      if (error) throw error;
      updateStats(data || {});
    }
  }

  async function loadTodayAssignment() {
    const today = nepalDateKey();
    const { data, error } = await client
      .from('quiz_daily_assignments')
      .select('id,quiz_date,question_id,quiz_questions!inner(id,question_text,status,quiz_options(id,option_text,position))')
      .eq('quiz_date', today)
      .eq('is_published', true)
      .eq('quiz_questions.status', 'published')
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.quiz_questions) return null;
    assignment = data;
    options = [...(data.quiz_questions.quiz_options || [])].sort((a, b) => a.position - b.position);
    if (options.length !== 4) throw new Error('Today’s quiz is not configured with four answer options.');
    return data;
  }

  async function getExistingResult() {
    const { data, error } = await client.rpc('get_daily_quiz_result', {
      p_assignment_id: assignment.id,
      p_guest_token_hash: currentUser ? null : guestTokenHash
    });
    if (error) throw error;
    return data;
  }

  function renderOptions(result = null) {
    el.options.replaceChildren();
    selectedOptionId = null;
    submitted = Boolean(result);
    options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.textContent = `${String.fromCharCode(65 + index)}. ${option.option_text}`;
      button.setAttribute('aria-pressed', 'false');
      if (result) {
        button.disabled = true;
        if (option.id === result.correct_option_id) button.classList.add('answer-correct');
        if (option.id === result.selected_option_id && !result.correct) button.classList.add('answer-incorrect');
        if (option.id === result.selected_option_id) button.classList.add('selected');
      } else {
        button.addEventListener('click', () => {
          if (submitted) return;
          selectedOptionId = option.id;
          el.options.querySelectorAll('.quiz-option').forEach(item => {
            item.classList.remove('selected');
            item.setAttribute('aria-pressed', 'false');
          });
          button.classList.add('selected');
          button.setAttribute('aria-pressed', 'true');
          el.submit.disabled = false;
        });
      }
      el.options.appendChild(button);
    });
  }

  function showResult(result) {
    renderOptions(result);
    const title = result.correct ? `Correct answer! +${result.points_awarded} points` : 'Not quite — 0 points this time';
    const answer = result.correct_answer || 'Correct answer unavailable';
    const explanation = result.explanation || 'Thanks for taking today’s challenge.';
    el.feedback.hidden = false;
    el.feedback.className = `quiz-feedback ${result.correct ? 'is-correct' : 'is-incorrect'}`;
    const strong = document.createElement('strong');
    strong.textContent = title;
    const answerLine = document.createElement('p');
    answerLine.textContent = `Correct answer: ${answer}`;
    const explanationLine = document.createElement('p');
    explanationLine.textContent = explanation;
    el.feedback.replaceChildren(strong, answerLine, explanationLine);
    el.submit.hidden = true;
    if (el.quit) el.quit.hidden = true;
    if (el.loginPrompt) el.loginPrompt.hidden = Boolean(currentUser);
    setReminder('You have completed today’s quiz. A new question will be available tomorrow.');
  }

  function showUnavailable(message) {
    el.question.textContent = message;
    el.options.replaceChildren();
    el.submit.hidden = true;
    if (el.quit) el.quit.hidden = true;
    el.feedback.hidden = true;
  }

  async function renderQuiz() {
    el.date.textContent = formatNepalDate();
    el.number.textContent = 'ONE QUESTION · FOUR CHOICES';
    el.submit.disabled = true;
    el.submit.hidden = false;
    if (el.quit) el.quit.hidden = false;
    if (el.feedback) el.feedback.hidden = true;
    if (el.loginPrompt) el.loginPrompt.hidden = true;

    const today = await loadTodayAssignment();
    if (!today) {
      showUnavailable('Today’s question is being prepared. Please check back soon.');
      setReminder('Today’s question is being prepared. Please check back later.');
      return false;
    }
    el.question.textContent = today.quiz_questions.question_text;
    const result = await getExistingResult();
    if (result) {
      showResult(result);
      return true;
    }
    renderOptions();
    setReminder('Your daily question is ready. Take a moment to test your knowledge.');
    return true;
  }

  async function submitAnswer() {
    if (!assignment || !selectedOptionId || submitted) return;
    el.submit.disabled = true;
    el.submit.textContent = 'Submitting…';
    try {
      const { data, error } = await client.rpc('submit_quiz_answer', {
        p_assignment_id: assignment.id,
        p_option_id: selectedOptionId,
        p_guest_token_hash: currentUser ? null : guestTokenHash
      });
      if (error) throw error;
      const result = await getExistingResult();
      if (result) showResult(result);
      else {
        // Defensive fallback: the submit RPC response still confirms the server-scored result.
        const selected = options.find(o => o.id === selectedOptionId);
        showResult({
          selected_option_id: selectedOptionId,
          correct_option_id: null,
          correct_answer: data?.correct ? selected?.option_text : 'Please refresh to view the answer',
          explanation: data?.message || '',
          correct: Boolean(data?.correct),
          points_awarded: Number(data?.points_awarded || 0)
        });
      }
      await loadStats();
    } catch (error) {
      setMessage(error.message || 'We could not submit your answer. Please try again.', 'is-incorrect');
      el.submit.disabled = false;
    } finally {
      el.submit.textContent = 'Submit answer ↗';
    }
  }

  function quitQuiz() {
    selectedOptionId = null;
    el.options.querySelectorAll('.quiz-option').forEach(button => {
      button.classList.remove('selected');
      button.setAttribute('aria-pressed', 'false');
    });
    el.submit.disabled = true;
    setMessage('Quiz paused. No answer has been submitted, and your streak and points are unchanged. You can return and play later today.');
  }

  async function initialise() {
    if (!client) {
      showUnavailable('The daily quiz is temporarily unavailable. Please try again later.');
      return;
    }
    try {
      const { data: { user } } = await client.auth.getUser();
      currentUser = user || null;
      if (currentUser) {
        guestTokenHash = await getStoredGuestHash(false);
        if (guestTokenHash) {
          await claimGuestProgress(guestTokenHash);
          guestTokenHash = null;
        }
      } else {
        guestTokenHash = await getStoredGuestHash(true);
      }
      await renderQuiz();
      await loadStats();
      const today = nepalDateKey();
      const alreadyShown = localStorage.getItem(REMINDER_KEY) === today;
      if (!alreadyShown) {
        localStorage.setItem(REMINDER_KEY, today);
        const done = submitted;
        setReminder(done ? 'You have completed today’s quiz. Come back tomorrow for a new question.' : 'Today’s quiz is ready. Tap here to jump to your daily question.', true);
      }
      if (el.dot) el.dot.hidden = localStorage.getItem(READ_KEY) === today;
    } catch (error) {
      console.error('Daily quiz could not load:', error);
      showUnavailable(error.message || 'We could not load today’s quiz. Please refresh the page.');
    }
  }

  el.submit.addEventListener('click', submitAnswer);
  el.quit?.addEventListener('click', quitQuiz);

  el.bell?.addEventListener('click', () => {
    const open = el.panel?.hidden;
    if (el.panel) el.panel.hidden = !open;
    el.bell?.setAttribute('aria-expanded', String(Boolean(open)));
    if (open) {
      localStorage.setItem(READ_KEY, nepalDateKey());
      if (el.dot) el.dot.hidden = true;
    }
  });
  el.closeNotice?.addEventListener('click', () => { if (el.toast) el.toast.hidden = true; });
  document.addEventListener('click', event => {
    if (!event.target.closest('.notification-wrap') && el.panel && !el.panel.hidden) {
      el.panel.hidden = true;
      el.bell?.setAttribute('aria-expanded', 'false');
    }
  });
  el.toast?.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    document.getElementById('dailyQuiz')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('notificationGoToQuiz')?.addEventListener('click', () => {
    if (el.panel) el.panel.hidden = true;
    el.bell?.setAttribute('aria-expanded', 'false');
    document.getElementById('dailyQuiz')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Keep Supabase auth callbacks synchronous; run database work after the callback returns.
  client?.auth.onAuthStateChange((event, session) => {
    if (event !== 'SIGNED_OUT' && event !== 'SIGNED_IN') return;
    Promise.resolve().then(async () => {
      if (event === 'SIGNED_OUT') {
        currentUser = null;
        guestTokenHash = null;
        localStorage.removeItem(GUEST_TOKEN_KEY);
        try { await initialise(); } catch (error) { console.warn(error); }
        return;
      }
      currentUser = session?.user || null;
      if (!currentUser) return;
      try {
        const pendingGuestHash = await getStoredGuestHash(false);
        if (pendingGuestHash) await claimGuestProgress(pendingGuestHash);
      } catch (error) {
        console.warn('Guest progress transfer:', error.message);
      }
      guestTokenHash = null;
      try {
        await renderQuiz();
        await loadStats();
      } catch (error) {
        console.warn(error);
      }
    });
  });

  initialise();
});
