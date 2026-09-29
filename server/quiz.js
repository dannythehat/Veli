import { QUESTIONS, topConcerns, safetyPlan, circleText } from '../plan.js';
import { json, clean, escapeHtml, EMAIL_PATTERN, isRateLimited, siteUrl, csvResponse } from './common.js';

const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEN_MINUTES = 10 * 60 * 1000;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

// Keeps only answers that match a real option, so stored text and tags are always ones we wrote.
export function sanitizeAnswers(raw = {}) {
  const answers = {};
  for (const q of QUESTIONS) {
    const value = raw?.[q.id];
    if (!value) continue;
    if (q.type === 'multi') {
      const tags = (Array.isArray(value) ? value : []).map((a) => a?.tag);
      const picked = q.options.filter((o) => tags.includes(o.tag)).slice(0, q.max);
      if (picked.length) answers[q.id] = picked.map(({ text, tag }) => ({ text, tag }));
    } else if (q.type === 'about') {
      const age = q.age.includes(value.age) ? value.age : '';
      const country = q.countries.includes(value.country) ? value.country : '';
      if (age && country) answers[q.id] = { text: `${age}, ${country}`, tag: 'about', age, country };
    } else {
      const option = q.options.find((o) => o.tag === value.tag);
      if (option) answers[q.id] = { text: option.text, tag: option.tag };
    }
  }
  return answers;
}

const answerText = (a) => (Array.isArray(a) ? a.map((x) => x.text).join(' | ') : a?.text || null);
const answerTags = (a) => (Array.isArray(a) ? a.map((x) => x.tag) : a?.tag || null);

function sessionFields(answers) {
  const fields = {};
  QUESTIONS.forEach((q) => { fields[q.id] = answerText(answers[q.id]); });
  fields.age_range = answers.q10?.age || null;
  fields.country = answers.q10?.country || null;
  fields.tags_json = JSON.stringify(Object.fromEntries(QUESTIONS.filter((q) => q.id !== 'q10' && answers[q.id]).map((q) => [q.id, answerTags(answers[q.id])])));
  fields.answers_json = JSON.stringify(answers);
  return fields;
}

async function upsertSession(env, request, body, answers, step, completed) {
  const now = new Date().toISOString();
  const fields = sessionFields(answers);
  const concerns = completed ? topConcerns(answers).map((c) => c.tag).join(',') : null;
  const utm = Object.fromEntries(UTM_KEYS.map((k) => [k, clean(body.utm?.[k], 120) || null]));

  await env.WAITLIST_DB.prepare(`
    INSERT INTO quiz_sessions (session_id, started_at, updated_at, last_step, completed, completed_at,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, age_range, country, tags_json, answers_json, top_concerns,
      referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ip_country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      updated_at = excluded.updated_at,
      last_step = MAX(quiz_sessions.last_step, excluded.last_step),
      completed = MAX(quiz_sessions.completed, excluded.completed),
      completed_at = COALESCE(quiz_sessions.completed_at, excluded.completed_at),
      q1 = excluded.q1, q2 = excluded.q2, q3 = excluded.q3, q4 = excluded.q4, q5 = excluded.q5,
      q6 = excluded.q6, q7 = excluded.q7, q8 = excluded.q8, q9 = excluded.q9, q10 = excluded.q10,
      age_range = excluded.age_range, country = excluded.country,
      tags_json = excluded.tags_json, answers_json = excluded.answers_json,
      top_concerns = COALESCE(excluded.top_concerns, quiz_sessions.top_concerns)`)
    .bind(
      body.session_id, now, now, step, completed ? 1 : 0, completed ? now : null,
      fields.q1, fields.q2, fields.q3, fields.q4, fields.q5, fields.q6, fields.q7, fields.q8, fields.q9, fields.q10,
      fields.age_range, fields.country, fields.tags_json, fields.answers_json, concerns,
      clean(body.referrer, 500) || null, utm.utm_source, utm.utm_medium, utm.utm_campaign, utm.utm_content, utm.utm_term,
      clean(request.cf?.country, 8) || null
    )
    .run();
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

export async function handleProgress(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' });
  const body = await readBody(request);
  if (!body || !SESSION_PATTERN.test(String(body.session_id || ''))) return json({ error: 'Invalid request.' }, 400);
  if (!env.WAITLIST_DB) return json({ error: 'Storage is not configured yet.' }, 503);
  if (await isRateLimited(request, env, { bucket: 'quiz', max: 60, windowMs: TEN_MINUTES })) {
    return json({ error: 'Too many requests.' }, 429, { 'retry-after': '600' });
  }

  const answers = sanitizeAnswers(body.answers);
  const step = Math.max(0, Math.min(QUESTIONS.length, Number.parseInt(body.step, 10) || 0));
  const completed = body.completed === true && step === QUESTIONS.length && Boolean(answers.q10);
  await upsertSession(env, request, body, answers, step, completed);
  return json({ ok: true });
}

function planEmail(answers, url) {
  const concerns = topConcerns(answers);
  const tips = safetyPlan(answers, concerns);
  const circle = circleText(answers);
  const p = 'margin:0 0 14px;font-size:15px;line-height:1.6;color:#4a4139';
  const h = 'font-family:Georgia,serif;font-weight:normal;color:#342d28';

  const html = `<!doctype html><html><body style="margin:0;background:#fbf8f3;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 22px">
    <p style="font-family:Georgia,serif;letter-spacing:.3em;font-size:20px;color:#342d28;margin:0 0 28px">VELI</p>
    <h1 style="${h};font-size:30px;margin:0 0 12px">Your personal safety plan</h1>
    <p style="${p}">Thank you for taking the 60 second safety check. Here is your plan, based on your answers.</p>
    <h2 style="${h};font-size:22px;margin:28px 0 12px">Three safety tips for you</h2>
    ${tips.map((t, i) => `<p style="${p}"><strong>${i + 1}. ${escapeHtml(t.title)}</strong><br>${escapeHtml(t.body)}</p>`).join('')}
    ${circle ? `<p style="${p}">You said you would want ${escapeHtml(circle)} told if something felt wrong. Ask them tonight if they are happy to be your first call.</p>` : ''}
    <h2 style="${h};font-size:22px;margin:28px 0 12px">How VELI is designed to help</h2>
    ${concerns.map((c) => `<p style="${p}"><strong>${escapeHtml(c.label)}.</strong> ${escapeHtml(c.help)}</p>`).join('')}
    <p style="${p}">You are on the VELI waitlist, so you will be among the first to hear when it is ready.</p>
    <p style="${p}"><a href="${escapeHtml(url)}" style="color:#876b46">Visit VELI</a></p>
    <p style="font-size:12px;line-height:1.6;color:#756b61;margin-top:30px">VELI is a concept in development. Features may change. Images are concept renders.
    You are getting this because you asked for your plan at ${escapeHtml(url)}. Reply with "unsubscribe" and we will remove you and delete your details. We never sell your data.</p>
  </div></body></html>`;

  const text = [
    'Your personal safety plan from VELI', '',
    ...tips.map((t, i) => `${i + 1}. ${t.title}\n${t.body}\n`),
    circle ? `You said you would want ${circle} told if something felt wrong. Ask them tonight if they are happy to be your first call.\n` : '',
    'How VELI is designed to help',
    ...concerns.map((c) => `${c.label}. ${c.help}`), '',
    `Visit VELI: ${url}`, '',
    'VELI is a concept in development. Features may change.',
    'Reply with "unsubscribe" and we will remove you and delete your details. We never sell your data.'
  ].join('\n');

  return { html, text };
}

// Sends through Resend when RESEND_API_KEY and EMAIL_FROM are set. Returns true only if it was accepted.
async function sendPlanEmail(env, to, answers, url) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;
  const { html, text } = planEmail(answers, url);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        reply_to: env.EMAIL_REPLY_TO || undefined,
        subject: 'Your personal safety plan from VELI',
        html,
        text,
        headers: env.EMAIL_REPLY_TO ? { 'List-Unsubscribe': `<mailto:${env.EMAIL_REPLY_TO}?subject=unsubscribe>` } : undefined
      })
    });
    if (!res.ok) console.error('Resend error', res.status, await res.text());
    return res.ok;
  } catch (error) {
    console.error('Resend request failed', error);
    return false;
  }
}

export async function handleSignup(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' });
  const body = await readBody(request);
  if (!body) return json({ error: 'Invalid request.' }, 400);

  // Honeypot: people never see this field. Pretend it worked.
  if (clean(body.website, 200)) return json({ ok: true, emailed: false }, 201);

  const email = clean(body.email, 254).toLowerCase();
  if (body.consent !== true) return json({ error: 'Please tick the box so we can email you.' }, 400);
  if (!EMAIL_PATTERN.test(email)) return json({ error: 'Please enter a valid email.' }, 400);
  if (!SESSION_PATTERN.test(String(body.session_id || ''))) return json({ error: 'Please take the check again.' }, 400);
  if (!env.WAITLIST_DB) return json({ error: 'Storage is not configured yet.' }, 503);
  if (await isRateLimited(request, env, { bucket: 'signup', max: 5, windowMs: TEN_MINUTES })) {
    return json({ error: 'Too many tries. Please wait a few minutes and try again.' }, 429, { 'retry-after': '600' });
  }

  let answers = sanitizeAnswers(body.answers);
  if (Object.keys(answers).length) {
    // Make sure the session row is complete even if a progress save was lost.
    await upsertSession(env, request, body, answers, answers.q10 ? QUESTIONS.length : 0, Boolean(answers.q10));
  } else {
    // No answers sent: keep whatever is stored and never wipe it.
    const stored = await env.WAITLIST_DB.prepare('SELECT answers_json FROM quiz_sessions WHERE session_id = ?').bind(body.session_id).first();
    try { answers = sanitizeAnswers(JSON.parse(stored?.answers_json || '{}')); } catch { answers = {}; }
    if (!stored) await upsertSession(env, request, body, {}, 0, false);
  }
  if (answers.q10?.age === 'Under 18') return json({ error: 'Sorry, the waitlist is for people aged 18 and over.' }, 400);
  const now = new Date().toISOString();
  const concerns = topConcerns(answers);

  await env.WAITLIST_DB.batch([
    env.WAITLIST_DB.prepare('UPDATE quiz_sessions SET email = ?, consent = 1, signed_up_at = COALESCE(signed_up_at, ?) WHERE session_id = ?')
      .bind(email, now, body.session_id),
    env.WAITLIST_DB.prepare(`INSERT INTO waitlist (email, consent, source, country, answer, referrer, created_at)
      VALUES (?, 1, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING`)
      .bind(email, 'safety check', clean(request.cf?.country, 8) || null,
        concerns.map((c) => c.label).join(', ') || null, clean(body.referrer, 500) || null, now)
  ]);

  const emailed = await sendPlanEmail(env, email, answers, siteUrl(env, request));
  if (emailed) {
    await env.WAITLIST_DB.prepare('UPDATE quiz_sessions SET plan_emailed = 1 WHERE session_id = ?').bind(body.session_id).run();
  }
  return json({ ok: true, emailed }, 201);
}

export async function quizExport(env) {
  const { results = [] } = await env.WAITLIST_DB.prepare('SELECT * FROM quiz_sessions ORDER BY started_at ASC').all();
  const rows = results.map((row) => {
    let tags = {};
    try { tags = JSON.parse(row.tags_json || '{}'); } catch { /* keep empty */ }
    const out = { ...row };
    QUESTIONS.filter((q) => q.id !== 'q10').forEach((q) => {
      out[`${q.id}_tag`] = Array.isArray(tags[q.id]) ? tags[q.id].join(',') : tags[q.id] || '';
    });
    out.questions_answered = row.last_step;
    return out;
  });
  const columns = [
    'session_id', 'started_at', 'updated_at', 'questions_answered', 'completed', 'completed_at',
    ...QUESTIONS.filter((q) => q.id !== 'q10').flatMap((q) => [q.id, `${q.id}_tag`]),
    'age_range', 'country', 'top_concerns', 'email', 'consent', 'signed_up_at', 'plan_emailed',
    'referrer', ...UTM_KEYS, 'ip_country'
  ];
  return csvResponse(columns, rows, 'veli-safety-check');
}
