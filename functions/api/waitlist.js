export async function onRequestPost({ request, env }) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid request.' }), { status: 400, headers }); }

  const email = String(body.email || '').trim().toLowerCase();
  const consent = body.consent === true;
  if (!consent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email.' }), { status: 400, headers });
  }
  if (!env.WAITLIST_DB) {
    return new Response(JSON.stringify({ error: 'Waitlist storage is not configured yet.' }), { status: 503, headers });
  }

  const existing = await env.WAITLIST_DB.prepare('SELECT id FROM waitlist WHERE email = ? LIMIT 1').bind(email).first();
  if (existing) return new Response(JSON.stringify({ ok: true, already_joined: true }), { status: 200, headers });

  await env.WAITLIST_DB.prepare('INSERT INTO waitlist (email, consent, source, created_at) VALUES (?, ?, ?, ?)')
    .bind(email, 1, 'website', new Date().toISOString()).run();
  return new Response(JSON.stringify({ ok: true, already_joined: false }), { status: 201, headers });
}
