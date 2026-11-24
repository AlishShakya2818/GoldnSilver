document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const db = window.gnsSupabase;

  async function renderLeaderboard(period = 'monthly') {
    const container = $('leaderboardList');
    if (!container) return;
    container.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'leaderboard-footnote';
    loading.textContent = 'Loading live rankings…';
    container.appendChild(loading);
    if (!db) { loading.textContent = 'Leaderboard is temporarily unavailable.'; return; }
    const { data, error } = await db.rpc('get_quiz_leaderboard', {
      p_period: period === 'alltime' ? 'all_time' : 'monthly', p_limit: 10
    });
    container.replaceChildren();
    if (error) {
      const message = document.createElement('p');
      message.className = 'leaderboard-footnote';
      message.textContent = 'Live rankings could not be loaded. Please try again later.';
      container.appendChild(message);
      return;
    }
    if (!data?.length) {
      const empty = document.createElement('p');
      empty.className = 'leaderboard-footnote';
      empty.textContent = 'No public rankings yet. Sign in, opt in to the leaderboard and start playing.';
      container.appendChild(empty);
      return;
    }
    data.forEach(person => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      const rank = document.createElement('span');
      rank.className = 'leaderboard-rank';
      rank.textContent = String(person.rank).padStart(2, '0');
      const user = document.createElement('div');
      user.className = 'leaderboard-user';
      const name = document.createElement('strong');
      name.textContent = person.username || person.display_name || 'Member';
      const detail = document.createElement('small');
      detail.textContent = `${Number(person.correct_answers || 0)} correct answers`;
      user.append(name, detail);
      const score = document.createElement('span');
      score.className = 'leaderboard-score';
      score.textContent = `${Number(person.points || 0).toLocaleString()} pts`;
      row.append(rank, user, score);
      container.appendChild(row);
    });
  }

  document.querySelectorAll('[data-leaderboard]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-leaderboard]').forEach(tab => tab.classList.toggle('active', tab === button));
      renderLeaderboard(button.dataset.leaderboard);
    });
  });

  async function updateAchievements() {
    const cards = [...document.querySelectorAll('[data-badge]')];
    if (!cards.length) return;
    const user = db ? (await db.auth.getUser()).data.user : null;
    if (!user) {
      cards.forEach(card => {
        card.classList.remove('unlocked');
        const state = card.querySelector('.achievement-state');
        if (state) state.textContent = 'SIGN IN';
      });
      return;
    }
    const { data, error } = await db.from('user_badges').select('badge_id,badges(code)').eq('user_id', user.id);
    if (error) return;
    const unlocked = new Set((data || []).map(item => item.badges?.code).filter(Boolean));
    const codes = { streak7: 'streak_7', streak30: 'streak_30', correct100: 'correct_100' };
    cards.forEach(card => {
      const isUnlocked = unlocked.has(codes[card.dataset.badge]);
      card.classList.toggle('unlocked', isUnlocked);
      const state = card.querySelector('.achievement-state');
      if (state) state.textContent = isUnlocked ? 'UNLOCKED' : 'LOCKED';
    });
  }

  // Prediction controls remain intentionally inactive until live market rounds are connected.
  const selections = { gold: null, silver: null };
  document.querySelectorAll('[data-metal][data-choice]').forEach(button => {
    button.addEventListener('click', () => {
      const metal = button.dataset.metal;
      const choice = button.dataset.choice;
      selections[metal] = choice;
      document.querySelectorAll(`[data-metal="${metal}"][data-choice]`).forEach(option => option.classList.toggle('selected', option === button));
      const submit = document.querySelector(`[data-submit-prediction="${metal}"]`);
      if (submit) submit.disabled = false;
      const message = $(`${metal}PredictionMessage`);
      if (message) message.textContent = `${choice.toUpperCase()} selected. Prediction rounds are not live yet.`;
    });
  });
  function openAccountWindow() {
    const modal = $('authModal');
    if (modal) {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('auth-open');
    } else $('accountButton')?.click();
  }
  document.querySelectorAll('[data-submit-prediction]').forEach(button => button.addEventListener('click', async () => {
    const metal = button.dataset.submitPrediction;
    const message = $(`${metal}PredictionMessage`);
    if (!selections[metal]) { if (message) message.textContent = 'Choose Higher or Lower first.'; return; }
    const user = db ? (await db.auth.getUser()).data.user : null;
    if (!user) { if (message) message.textContent = 'Sign in to participate when prediction rounds are available.'; openAccountWindow(); return; }
    if (message) message.textContent = 'Your account is recognised. Live prediction rounds are not connected yet; no prediction was submitted.';
  }));

  document.addEventListener('gns:quiz-updated', updateAchievements);
  db?.auth.onAuthStateChange(() => updateAchievements());
  renderLeaderboard('monthly');
  updateAchievements();
});
