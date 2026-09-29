import { json, clean, EMAIL_PATTERN, isRateLimited, siteUrl, providedToken, tokenMatches, csvResponse } from './server/common.js';
import { handleProgress, handleSignup, quizExport } from './server/quiz.js';
import { summaryPage, loginPage } from './server/admin.js';

// The public counter stays hidden until the list is bigger than this.
const COUNTER_THRESHOLD = 100;
const SITE_URL_PLACEHOLDER = /__SITE_URL__/g;
const HTML_PAGES = new Set(['/', '/index.html', '/check', '/check.html', '/joined', '/joined.html']);
const PUBLIC_PATHS = ['/', '/check'];

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

  if (await isRateLimited(request, env, { bucket: 'waitlist', max: 5, windowMs: 10 * 60 * 1000 })) {
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

async function waitlistExport(env) {
  const { results = [] } = await env.WAITLIST_DB
    .prepare('SELECT id, email, answer, created_at, referrer, source, country FROM waitlist ORDER BY created_at ASC')
    .all();
  return csvResponse(['id', 'email', 'answer', 'created_at', 'referrer', 'source', 'country'], results, 'veli-waitlist');
}

async function handleAdmin(request, env, url) {
  if (!env.ADMIN_TOKEN) return json({ error: 'Not found.' }, 404);
  const token = providedToken(request);
  const html = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' };

  if (!(await tokenMatches(token, env.ADMIN_TOKEN))) {
    if (url.pathname === '/admin') return new Response(loginPage, { status: token ? 401 : 200, headers: html });
    return json({ error: 'Unauthorised.' }, 401);
  }
  if (!env.WAITLIST_DB) return json({ error: 'Storage is not configured yet.' }, 503);

  if (url.pathname === '/admin') return new Response(await summaryPage(env, token), { headers: html });
  if (url.pathname === '/api/admin/quiz-export') return quizExport(env);
  if (url.searchParams.get('format') === 'json') {
    const { results = [] } = await env.WAITLIST_DB.prepare('SELECT id, email, answer, created_at, referrer, source, country FROM waitlist ORDER BY created_at ASC').all();
    return json({ total: results.length, signups: results });
  }
  return waitlistExport(env);
}

// Fills __SITE_URL__ in page meta tags (canonical, Open Graph, Twitter) from the SITE_URL setting.
async function servePage(request, env, url) {
  // Every /check/... address is the same quiz page. The quiz uses them for analytics page views.
  const assetUrl = url.pathname.startsWith('/check/') ? new URL('/check', url) : url;
  const response = await env.ASSETS.fetch(new Request(assetUrl, request));
  if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) return response;

  const body = (await response.text()).replace(SITE_URL_PLACEHOLDER, siteUrl(env, request));
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  return new Response(body, { status: response.status, headers });
}

function sitemap(env, request) {
  const base = siteUrl(env, request);
  const urls = PUBLIC_PATHS.map((path) => `  <url><loc>${base}${path === '/' ? '/' : path}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' }
  });
}

function robots(env, request) {
  return new Response(`User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl(env, request)}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/api/waitlist') return await handleWaitlist(request, env);
      if (path === '/api/waitlist/count' && request.method === 'GET') return await handleCount(env);
      if (path === '/api/quiz/progress') return await handleProgress(request, env);
      if (path === '/api/quiz/signup') return await handleSignup(request, env);
      if ((path === '/admin' || path === '/api/admin/export' || path === '/api/admin/quiz-export') && request.method === 'GET') {
        return await handleAdmin(request, env, url);
      }
    } catch (error) {
      console.error('API error', error);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }

    if (path.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    if (path === '/sitemap.xml') return sitemap(env, request);
    if (path === '/robots.txt') return robots(env, request);
    if (HTML_PAGES.has(path) || path.startsWith('/check/')) return servePage(request, env, url);

    return env.ASSETS.fetch(request);
  }
};
