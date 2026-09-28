const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

async function handleWaitlist(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...jsonHeaders, allow: 'POST' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), { status: 400, headers: jsonHeaders });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const consent = body.consent === true;

  if (!consent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email.' }), { status: 400, headers: jsonHeaders });
  }

  if (!env.WAITLIST_DB) {
    return new Response(JSON.stringify({ error: 'Waitlist storage is not configured yet.' }), { status: 503, headers: jsonHeaders });
  }

  const existing = await env.WAITLIST_DB
    .prepare('SELECT id FROM waitlist WHERE email = ? LIMIT 1')
    .bind(email)
    .first();

  if (existing) {
    return new Response(JSON.stringify({ ok: true, already_joined: true }), { status: 200, headers: jsonHeaders });
  }

  await env.WAITLIST_DB
    .prepare('INSERT INTO waitlist (email, consent, source, created_at) VALUES (?, ?, ?, ?)')
    .bind(email, 1, 'website', new Date().toISOString())
    .run();

  return new Response(JSON.stringify({ ok: true, already_joined: false }), { status: 201, headers: jsonHeaders });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/waitlist') {
      return handleWaitlist(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
