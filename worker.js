const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

// Signups per IP address allowed inside the rate limit window.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
// Attempt records are only kept long enough to rate limit.
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;
// The public counter stays hidden until the list is bigger than this.
const COUNTER_THRESHOLD = 100;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extraHeaders } });

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function isRateLimited(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipHash = await sha256Hex(`${env.RATE_LIMIT_SALT || 'veli-waitlist'}:${ip}`);
  const now = Date.now();

  await env.WAITLIST_DB.batch([
    env.WAITLIST_DB.prepare('DELETE FROM waitlist_attempts WHERE created_at < ?').bind(now - ATTEMPT_RETENTION_MS),
    env.WAITLIST_DB.prepare('INSERT INTO waitlist_attempts (ip_hash, created_at) VALUES (?, ?)').bind(ipHash, now)
  ]);

  const row = await env.WAITLIST_DB
    .prepare('SELECT COUNT(*) AS attempts FROM waitlist_attempts WHERE ip_hash = ? AND created_at >= ?')
    .bind(ipHash, now - RATE_LIMIT_WINDOW_MS)
    .first();

  return (row?.attempts || 0) > RATE_LIMIT_MAX;
}

async function handleWaitlist(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  // Honeypot: people never see this field, bots fill it in. Pretend it worked.
  if (clean(body.website, 200)) {
    return json({ ok: true, already_joined: false }, 201);
  }

  const email = clean(body.email, 254).toLowerCase();
  const consent = body.consent === true;

  if (!consent) {
    return json({ error: 'Please tick the box so we can email you.' }, 400);
  }
  if (!EMAIL_PATTERN.test(email)) {
    return json({ error: 'Please enter a valid email.' }, 400);
  }

  if (!env.WAITLIST_DB) {
    return json({ error: 'Waitlist storage is not configured yet.' }, 503);
  }

  if (await isRateLimited(request, env)) {
    return json({ error: 'Too many tries. Please wait a few minutes and try again.' }, 429, { 'retry-after': '600' });
  }

  const answer = clean(body.answer, 500) || null;
  const referrer = clean(body.referrer, 500) || null;
  const source = clean(body.source, 120) || 'website';
  const country = clean(request.cf?.country, 8) || null;

  const existing = await env.WAITLIST_DB
    .prepare('SELECT id, answer FROM waitlist WHERE email = ? LIMIT 1')
    .bind(email)
    .first();

  if (existing) {
    if (answer && !existing.answer) {
      await env.WAITLIST_DB.prepare('UPDATE waitlist SET answer = ? WHERE id = ?').bind(answer, existing.id).run();
    }
    return json({ ok: true, already_joined: true });
  }

  await env.WAITLIST_DB
    .prepare('INSERT INTO waitlist (email, consent, source, country, answer, referrer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(email, 1, source, country, answer, referrer, new Date().toISOString())
    .run();

  return json({ ok: true, already_joined: false }, 201);
}

async function handleCount(env) {
  if (!env.WAITLIST_DB) return json({ count: null });
  const row = await env.WAITLIST_DB.prepare('SELECT COUNT(*) AS total FROM waitlist').first();
  const total = row?.total || 0;
  // Only reveal the number once it is big enough to help rather than hurt.
  return json({ count: total > COUNTER_THRESHOLD ? total : null }, 200, { 'cache-control': 'public, max-age=60' });
}

async function tokenMatches(provided, expected) {
  const [a, b] = await Promise.all([sha256Hex(provided), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Stop spreadsheet apps treating free text as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function handleExport(request, env) {
  if (!env.ADMIN_TOKEN) return json({ error: 'Not found.' }, 404);

  const url = new URL(request.url);
  const header = request.headers.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('token') || '';

  if (!provided || !(await tokenMatches(provided, env.ADMIN_TOKEN))) {
    return json({ error: 'Unauthorised.' }, 401);
  }
  if (!env.WAITLIST_DB) {
    return json({ error: 'Waitlist storage is not configured yet.' }, 503);
  }

  const { results = [] } = await env.WAITLIST_DB
    .prepare('SELECT id, email, answer, created_at, referrer, source, country FROM waitlist ORDER BY created_at ASC')
    .all();

  if (url.searchParams.get('format') === 'json') {
    return json({ total: results.length, signups: results });
  }

  const columns = ['id', 'email', 'answer', 'created_at', 'referrer', 'source', 'country'];
  const csv = [columns.join(','), ...results.map((row) => columns.map((c) => csvCell(row[c])).join(','))].join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="veli-waitlist-${stamp}.csv"`,
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/waitlist') return await handleWaitlist(request, env);
      if (url.pathname === '/api/waitlist/count' && request.method === 'GET') return await handleCount(env);
      if (url.pathname === '/api/admin/export' && request.method === 'GET') return await handleExport(request, env);
    } catch (error) {
      console.error('API error', error);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);

    return env.ASSETS.fetch(request);
  }
};
