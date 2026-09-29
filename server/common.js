const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

// Attempt records are only kept long enough to rate limit.
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extraHeaders } });

export const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The one place the public address comes from. SITE_URL is set in the deploy workflow;
// when it is empty the address the visitor used is taken instead.
export const siteUrl = (env, request) => (clean(env.SITE_URL, 200) || new URL(request.url).origin).replace(/\/+$/, '');

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Counts attempts per hashed IP in D1. Each bucket (waitlist, quiz, signup) has its own limit.
export async function isRateLimited(request, env, { bucket, max, windowMs }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipHash = await sha256Hex(`${env.RATE_LIMIT_SALT || 'veli-waitlist'}:${bucket}:${ip}`);
  const now = Date.now();

  await env.WAITLIST_DB.batch([
    env.WAITLIST_DB.prepare('DELETE FROM waitlist_attempts WHERE created_at < ?').bind(now - ATTEMPT_RETENTION_MS),
    env.WAITLIST_DB.prepare('INSERT INTO waitlist_attempts (ip_hash, created_at) VALUES (?, ?)').bind(ipHash, now)
  ]);

  const row = await env.WAITLIST_DB
    .prepare('SELECT COUNT(*) AS attempts FROM waitlist_attempts WHERE ip_hash = ? AND created_at >= ?')
    .bind(ipHash, now - windowMs)
    .first();

  return (row?.attempts || 0) > max;
}

export function providedToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : new URL(request.url).searchParams.get('token') || '';
}

export async function tokenMatches(provided, expected) {
  if (!provided || !expected) return false;
  const [a, b] = await Promise.all([sha256Hex(provided), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Stop spreadsheet apps treating free text as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvResponse(columns, rows, name) {
  const csv = [columns.join(','), ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(','))].join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}-${stamp}.csv"`,
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex'
    }
  });
}
