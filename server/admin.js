import { QUESTIONS, CONCERNS } from '../plan.js';
import { escapeHtml } from './common.js';

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

function tally(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return counts;
}

// One horizontal bar list: label, bar and value on each row. A single series, so no legend.
function bars(title, counts, total, { order, note } = {}) {
  const labels = order ? order.filter((l) => counts.has(l)).concat([...counts.keys()].filter((l) => !order.includes(l)))
    : [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
  const rows = labels.map((label) => {
    const n = counts.get(label) || 0;
    const p = pct(n, total);
    return `<tr title="${escapeHtml(label)}: ${n} of ${total} (${p}%)"><th scope="row">${escapeHtml(label)}</th>
      <td class="bar-cell"><span class="bar" style="width:${Math.max(p, n ? 1 : 0)}%"></span></td>
      <td class="num">${p}%</td><td class="num muted">${n}</td></tr>`;
  }).join('');
  return `<section class="card"><h2>${escapeHtml(title)}</h2>${note ? `<p class="note">${escapeHtml(note)}</p>` : ''}
    ${total ? `<table><tbody>${rows}</tbody></table>` : '<p class="note">No answers yet.</p>'}</section>`;
}

export async function summaryPage(env, token) {
  const [{ results: sessions = [] }, waitlistRow] = await Promise.all([
    env.WAITLIST_DB.prepare('SELECT last_step, completed, email, tags_json, answers_json, country FROM quiz_sessions').all(),
    env.WAITLIST_DB.prepare('SELECT COUNT(*) AS total FROM waitlist').first()
  ]);

  const parsed = sessions.map((s) => {
    let answers = {};
    try { answers = JSON.parse(s.answers_json || '{}'); } catch { /* keep empty */ }
    return { ...s, answers };
  });
  const starts = parsed.length;
  const completed = parsed.filter((s) => s.completed);
  const signups = parsed.filter((s) => s.email).length;
  const answeredBy = (id) => parsed.filter((s) => s.answers[id]);

  const q3 = answeredBy('q3');
  const concernCounts = new Map();
  q3.forEach((s) => s.answers.q3.forEach((a) => concernCounts.set(CONCERNS[a.tag]?.label || a.text, (concernCounts.get(CONCERNS[a.tag]?.label || a.text) || 0) + 1)));

  const single = (id) => tally(answeredBy(id).map((s) => s.answers[id].text));
  const orderOf = (id) => QUESTIONS.find((q) => q.id === id).options.map((o) => o.text);

  const q7 = answeredBy('q7');
  const wouldCarry = q7.filter((s) => s.answers.q7.tag !== 'no').length;

  const funnel = QUESTIONS.map((q, i) => {
    const reached = parsed.filter((s) => s.last_step >= i).length;
    const answered = parsed.filter((s) => s.last_step >= i + 1).length;
    return { label: `Q${i + 1}`, title: q.title, reached, answered, dropped: reached - answered };
  });
  const funnelRows = funnel.map((f) => `<tr title="${escapeHtml(f.title)}"><th scope="row">${f.label}</th>
    <td class="q-title">${escapeHtml(f.title)}</td>
    <td class="bar-cell"><span class="bar" style="width:${pct(f.reached, starts)}%"></span></td>
    <td class="num">${pct(f.reached, starts)}%</td><td class="num muted">${f.reached}</td>
    <td class="num drop">${f.dropped ? `−${f.dropped}` : '0'}</td></tr>`).join('');

  const tile = (label, value, sub) => `<div class="tile"><p class="tile-label">${label}</p><p class="tile-value">${value}</p>${sub ? `<p class="tile-sub">${sub}</p>` : ''}</div>`;
  const exportLink = (path) => `${path}?token=${encodeURIComponent(token)}`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>VELI admin</title>
<style>
:root{--ink:#4a4139;--muted:#756b61;--paper:#fbf8f3;--card:#fff;--line:rgba(74,65,57,.12);--bar:#a98758;--track:#f1e8dc;--drop:#9e4f45}
@media (prefers-color-scheme:dark){:root{--ink:#efe7dc;--muted:#b3a89d;--paper:#231f1c;--card:#2d2825;--line:rgba(255,255,255,.1);--bar:#d0ad7a;--track:#3a332e;--drop:#e39b90}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,sans-serif;padding:24px 16px 60px}
main{max-width:1000px;margin:0 auto}h1{font:400 34px Georgia,serif;margin:0 0 4px}h2{font:400 21px Georgia,serif;margin:0 0 12px}
.lead{color:var(--muted);margin:0 0 22px}.lead a{color:inherit}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.tile,.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.tile-label{margin:0;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.tile-value{margin:4px 0 0;font:400 34px Georgia,serif}.tile-sub{margin:2px 0 0;font-size:12px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:14px}
table{width:100%;border-collapse:collapse}th,td{padding:6px 4px;text-align:left;font-weight:400;vertical-align:middle}
th{font-size:14px;padding-right:10px;line-height:1.3}.bar-cell{width:38%;min-width:56px}.bar{display:block;height:10px;background:var(--bar);border-radius:0 4px 4px 0;min-width:0}
td.bar-cell{background:linear-gradient(var(--track),var(--track)) no-repeat left center/100% 10px}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:8px}.muted{color:var(--muted);font-size:13px}.drop{color:var(--drop);font-size:13px}
.q-title{font-size:13px;color:var(--muted);width:40%}.note{color:var(--muted);font-size:13px;margin:-4px 0 10px}
@media (max-width:640px){.q-title{display:none}.grid{grid-template-columns:1fr}.tile-value{font-size:28px}}
</style></head><body><main>
<h1>VELI safety check</h1>
<p class="lead">Live from D1. Download: <a href="${escapeHtml(exportLink('/api/admin/quiz-export'))}">safety check CSV</a> · <a href="${escapeHtml(exportLink('/api/admin/export'))}">waitlist CSV</a></p>
<div class="tiles">
  ${tile('Starts', starts)}
  ${tile('Completions', completed.length, `${pct(completed.length, starts)}% of starts`)}
  ${tile('Signups from check', signups, `${pct(signups, completed.length)}% of completions`)}
  ${tile('Would carry it', `${pct(wouldCarry, q7.length)}%`, `${wouldCarry} of ${q7.length} said yes, maybe or if stylish`)}
  ${tile('Total waitlist', waitlistRow?.total || 0, 'All sources')}
</div>
<section class="card"><h2>Drop off per question</h2><p class="note">Share of starts who reached each question, and how many left there.</p>
${starts ? `<table><thead><tr><th></th><th class="q-title">Question</th><th>Reached</th><th class="num">%</th><th class="num">n</th><th class="num">Left</th></tr></thead><tbody>${funnelRows}</tbody></table>` : '<p class="note">No starts yet.</p>'}</section>
<div class="grid">
  ${bars('Top worries (Q3)', concernCounts, q3.length, { note: 'Share of people who picked each worry. People can pick 2.' })}
  ${bars('Would carry it (Q7)', single('q7'), q7.length, { order: orderOf('q7') })}
  ${bars('Expected price (Q8)', single('q8'), answeredBy('q8').length, { order: orderOf('q8') })}
  ${bars('Colour (Q9)', single('q9'), answeredBy('q9').length, { order: orderOf('q9') })}
  ${bars('Country (Q10)', tally(parsed.map((s) => s.answers.q10?.country)), answeredBy('q10').length)}
  ${bars('Age range (Q10)', tally(parsed.map((s) => s.answers.q10?.age)), answeredBy('q10').length, { order: QUESTIONS[9].age })}
  ${bars('Getting home (Q2)', single('q2'), answeredBy('q2').length, { order: orderOf('q2') })}
  ${bars('Phone when out (Q6)', single('q6'), answeredBy('q6').length, { order: orderOf('q6') })}
</div>
</main></body></html>`;
}

export const loginPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>VELI admin</title>
<style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#fbf8f3;color:#4a4139;font:15px system-ui,sans-serif;padding:16px}
form{display:grid;gap:10px;width:min(360px,100%)}h1{font:400 30px Georgia,serif;margin:0}input,button{font:inherit;padding:13px 16px;border-radius:999px;border:1px solid rgba(74,65,57,.2)}
button{background:#a98758;color:#fff;border-color:#a98758;cursor:pointer}</style></head>
<body><form method="get" action="/admin"><h1>VELI admin</h1><label for="t">Admin token</label><input id="t" name="token" type="password" autocomplete="current-password" required><button>Open summary</button></form></body></html>`;
