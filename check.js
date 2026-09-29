import { QUESTIONS, topConcerns, safetyPlan, circleText } from '/plan.js';

const quiz = document.getElementById('quiz');
const body = document.getElementById('questionBody');
const progressBar = document.getElementById('progressBar');
const progressCount = document.getElementById('progressCount');
const progress = document.querySelector('.progress');
const track = (name, state) => window.veliTrack?.(name, state);

const state = {
  sessionId: null,
  answers: {},
  furthest: 0
};

const params = new URLSearchParams(window.location.search);
const utm = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
  .map((key) => [key, (params.get(key) || '').slice(0, 120)])
  .filter(([, value]) => value));
const referrer = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : '';

const newSessionId = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

// Saves progress after every answer, so partial completions show where people drop off.
function saveProgress(completed = false) {
  if (!state.sessionId) return;
  fetch('/api/quiz/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ session_id: state.sessionId, step: state.furthest, answers: state.answers, completed, referrer, utm })
  }).catch(() => {});
}

function show(screen) {
  quiz.dataset.screen = screen;
  window.scrollTo(0, 0);
}

function setProgress(index) {
  const n = index + 1;
  progressBar.style.width = `${(n / QUESTIONS.length) * 100}%`;
  progressCount.textContent = `${n} of ${QUESTIONS.length}`;
  progress.setAttribute('aria-valuenow', String(n));
}

function renderQuestion(index) {
  const q = QUESTIONS[index];
  setProgress(index);
  show('question');

  const saved = state.answers[q.id];
  let html = `<h2 class="question-title" id="qTitle" tabindex="-1">${q.title}</h2>`;
  html += `<p class="question-hint" id="qHint">${q.hint || '&nbsp;'}</p>`;

  if (q.type === 'single' || q.type === 'multi') {
    const selected = new Set((Array.isArray(saved) ? saved : saved ? [saved] : []).map((a) => a.tag));
    html += `<div class="options ${q.options.length > 4 ? 'options-long' : ''}" role="group" aria-labelledby="qTitle">`;
    html += q.options.map((o) => `<button type="button" class="option" data-tag="${o.tag}" aria-pressed="${selected.has(o.tag)}"><span>${o.text}</span></button>`).join('');
    html += '</div>';
    if (q.type === 'multi') html += `<button type="button" class="button continue" id="continueButton" ${selected.size ? '' : 'disabled'}>Continue <span aria-hidden="true">→</span></button>`;
  } else if (q.type === 'colour') {
    html += '<div class="colour-options" role="group" aria-labelledby="qTitle">';
    html += q.options.map((o) => `<button type="button" class="colour-option" data-tag="${o.tag}" aria-pressed="${saved?.tag === o.tag}"><img src="${o.image}" width="640" height="800" alt="" decoding="async" /><span>${o.text}</span></button>`).join('');
    html += '</div>';
  } else if (q.type === 'about') {
    const option = (list, current) => list.map((v) => `<option ${current === v ? 'selected' : ''}>${v}</option>`).join('');
    html += `<div class="about-fields">
      <label for="ageSelect">Age range</label>
      <select id="ageSelect" required><option value="">Choose your age range</option>${option(q.age, saved?.age)}</select>
      <label for="countrySelect">Country</label>
      <select id="countrySelect" required><option value="">Choose your country</option>${option(q.countries, saved?.country)}</select>
    </div>
    <button type="button" class="button continue" id="continueButton" ${saved?.age && saved?.country ? '' : 'disabled'}>See my results <span aria-hidden="true">→</span></button>`;
  }

  body.innerHTML = html;
  body.classList.remove('enter');
  void body.offsetWidth;
  body.classList.add('enter');
  document.getElementById('qTitle').focus({ preventScroll: true });
  wireQuestion(index);
}

function answered(index) {
  state.furthest = Math.max(state.furthest, index + 1);
  const isLast = index === QUESTIONS.length - 1;
  saveProgress(isLast);
  if (isLast) {
    track('quiz_complete', { screen: 'result' });
    renderResult();
  } else {
    track(`q${index + 1}_answered`, { screen: 'question', index: index + 1 });
    renderQuestion(index + 1);
  }
}

function wireQuestion(index) {
  const q = QUESTIONS[index];
  const hint = document.getElementById('qHint');
  const continueButton = document.getElementById('continueButton');

  if (q.type === 'single' || q.type === 'colour') {
    body.querySelectorAll('[data-tag]').forEach((button) => {
      button.addEventListener('click', () => {
        body.querySelectorAll('[data-tag]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true');
        const option = q.options.find((o) => o.tag === button.dataset.tag);
        state.answers[q.id] = { text: option.text, tag: option.tag };
        setTimeout(() => answered(index), 260);
      });
    });
  }

  if (q.type === 'multi') {
    body.querySelectorAll('[data-tag]').forEach((button) => {
      button.addEventListener('click', () => {
        const on = button.getAttribute('aria-pressed') === 'true';
        const count = body.querySelectorAll('[aria-pressed="true"]').length;
        if (!on && count >= q.max) {
          hint.classList.remove('nudge');
          void hint.offsetWidth;
          hint.classList.add('nudge');
          return;
        }
        button.setAttribute('aria-pressed', String(!on));
        const chosen = [...body.querySelectorAll('[aria-pressed="true"]')].map((b) => q.options.find((o) => o.tag === b.dataset.tag));
        state.answers[q.id] = chosen.map((o) => ({ text: o.text, tag: o.tag }));
        continueButton.disabled = chosen.length === 0;
      });
    });
    continueButton.addEventListener('click', () => answered(index));
  }

  if (q.type === 'about') {
    const age = document.getElementById('ageSelect');
    const country = document.getElementById('countrySelect');
    const update = () => {
      if (age.value && country.value) {
        state.answers[q.id] = { text: `${age.value}, ${country.value}`, tag: 'about', age: age.value, country: country.value };
      }
      continueButton.disabled = !(age.value && country.value);
    };
    age.addEventListener('change', update);
    country.addEventListener('change', update);
    continueButton.addEventListener('click', () => { update(); if (!continueButton.disabled) answered(index); });
  }
}

function renderResult() {
  const concerns = topConcerns(state.answers);
  const tips = safetyPlan(state.answers, concerns);

  document.getElementById('concernList').innerHTML = concerns.map((c, i) => `
    <article class="concern-card">
      <span class="concern-number">0${i + 1}</span>
      <p class="concern-label">${c.chosen ? 'Your worry' : 'Worth planning for'}</p>
      <h3>${c.label}</h3>
      <p class="concern-help-label">How VELI is designed to help</p>
      <p>${c.help}</p>
    </article>`).join('');

  document.getElementById('planTips').innerHTML = tips.map((t) => `
    <li><strong>${t.title}</strong><p class="tip-body">${t.body}</p></li>`).join('');

  const circle = circleText(state.answers);
  const circleEl = document.getElementById('planCircle');
  circleEl.hidden = !circle;
  if (circle) circleEl.textContent = `You said you would want ${circle} told if something felt wrong. Ask them tonight if they are happy to be your first call.`;

  const colour = QUESTIONS[8].options.find((o) => o.tag === state.answers.q9?.tag);
  const colourEl = document.getElementById('gateColour');
  colourEl.hidden = !colour;
  if (colour) colourEl.innerHTML = `<img src="${colour.image}" width="640" height="800" alt="${colour.text} VELI. Concept render." loading="lazy" /><span>Your VELI in ${colour.text}</span>`;

  const plan = document.querySelector('.plan');
  const under18 = state.answers.q10?.age === 'Under 18';
  plan.classList.toggle('locked', !under18);
  document.getElementById('gate').hidden = under18;
  document.getElementById('gateSuccess').hidden = true;

  show('result');
  document.getElementById('result').focus({ preventScroll: true });
}

function unlockPlan() {
  document.querySelector('.plan').classList.remove('locked');
}

document.getElementById('startCheck').addEventListener('click', () => {
  if (!state.sessionId) {
    state.sessionId = newSessionId();
    saveProgress();
  }
  track('quiz_start', { screen: 'question', index: 0 });
  renderQuestion(0);
});

document.getElementById('backButton').addEventListener('click', () => window.history.back());

window.addEventListener('popstate', (event) => {
  const s = event.state || { screen: 'landing' };
  if (s.screen === 'question' && state.sessionId) renderQuestion(s.index);
  else if (s.screen === 'result' && state.answers.q10) renderResult();
  else show('landing');
});

document.getElementById('skipGate').addEventListener('click', () => {
  unlockPlan();
  document.querySelector('.plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

const gateForm = document.getElementById('gateForm');
const gateStatus = document.getElementById('gateStatus');
gateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  gateStatus.className = 'form-status';
  const data = new FormData(gateForm);
  const email = String(data.get('email') || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    gateStatus.textContent = 'Please enter a valid email address.';
    gateStatus.classList.add('error');
    return;
  }
  if (data.get('consent') !== 'on') {
    gateStatus.textContent = 'Please tick the box so we can email you.';
    gateStatus.classList.add('error');
    return;
  }

  const submit = gateForm.querySelector('button[type="submit"]');
  const original = submit.innerHTML;
  submit.disabled = true;
  submit.textContent = 'Sending…';
  try {
    const res = await fetch('/api/quiz/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: state.sessionId, email, consent: true, website: String(data.get('website') || ''), answers: state.answers, referrer, utm })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'We could not add you just now. Please try again.');

    document.getElementById('gate').hidden = true;
    const success = document.getElementById('gateSuccess');
    document.getElementById('gateSuccessText').textContent = result.emailed
      ? 'Your plan is on its way to your inbox. It is also below, so you can read it now.'
      : 'Your full plan is below. Take a screenshot so you have it with you.';
    success.hidden = false;
    unlockPlan();
    success.focus({ preventScroll: true });
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    track('email_signup', { screen: 'result' });
  } catch (error) {
    gateStatus.textContent = error instanceof TypeError || !error.message
      ? 'We could not add you just now. Please check your connection and try again.'
      : error.message;
    gateStatus.classList.add('error');
    submit.disabled = false;
    submit.innerHTML = original;
  }
});

document.getElementById('shareCheck').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const url = `${window.location.origin}/check`;
  try {
    if (navigator.share) await navigator.share({ title: 'The 60 Second Safety Check', text: 'How safe do you feel when you\'re out alone? Take the 60 second safety check.', url });
    else {
      await navigator.clipboard.writeText(url);
      button.textContent = 'Link copied';
    }
  } catch {
    // Share sheet closed.
  }
});

window.history.replaceState({ screen: 'landing' }, '', `/check${window.location.search}`);
