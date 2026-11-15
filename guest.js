const sb = supabase.createClient(CFG.url, CFG.key);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token = new URLSearchParams(location.search).get('t');
const el = $('app');
let inv = null, s = { i: 0, status: '', count: 1, veg: 1, time: '' };
const seq = () => s.status === 'no' ? ['who', 'sum'] : ['who', 'count', 'food', 'time', 'sum'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const stepper = (f, v) => `<div class="stp"><button data-d="-1" data-f="${f}" aria-label="Less">−</button><b>${v}</b><button data-d="1" data-f="${f}" aria-label="More">+</button></div>`;

async function start() {
  if (!token) return el.innerHTML = '<h1>Link not valid</h1><p>Please ask the family to send your link again.</p>';
  const { data, error } = await sb.rpc('get_invite', { p_token: token });
  if (error || !data || !data.length) return el.innerHTML = '<h1>Link not valid</h1><p>Please ask the family to send your link again.</p>';
  inv = data[0]; draw();
}
function draw() {
  const q = seq(), k = q[s.i];
  let h = `<h1>${esc(inv.wedding_name)}</h1><p class="note">${inv.event_date ? esc(inv.event_date) : ''}</p>
    <div class="bar"><div style="width:${Math.round((s.i + 1) / q.length * 100)}%"></div></div><div class="panel">`;
  if (k === 'who') h += `<h2>Namaste ${esc(inv.guest_name)}, will you come?</h2>
    <button data-a="yes" class="big">Yes, I’ll be there</button><button data-a="maybe" class="big ghost">Maybe</button><button data-a="no" class="big ghost">Sorry, can’t come</button>`;
  if (k === 'count') h += `<h2>How many people are coming?</h2><p class="note">Count everyone in your family, including you.</p>${stepper('count', s.count)}<button id="nx" class="big">Next</button>`;
  if (k === 'food') h += `<h2>How many of them eat veg?</h2><p class="note">Out of ${s.count} people. The rest get non-veg.</p>${stepper('veg', s.veg)}<p style="text-align:center">${s.veg} veg and ${s.count - s.veg} non-veg</p><button id="nx" class="big">Next</button>`;
  if (k === 'time') h += `<h2>When will you arrive?</h2><button data-t="Morning" class="big ghost">Morning</button><button data-t="Afternoon" class="big ghost">Afternoon</button><button data-t="Evening" class="big ghost">Evening</button>
    <label for="tm"><b>Or pick an exact time</b></label><input id="tm" type="time" style="margin:4px 0 12px"><button id="nx" class="big">Next</button>`;
  if (k === 'sum') h += `<h2>Check your reply</h2><p>${s.status === 'no' ? 'Sorry you can’t come. The family will miss you.' : `You are ${s.status === 'yes' ? 'coming' : 'maybe coming'} with ${s.count} people (${s.veg} veg, ${s.count - s.veg} non-veg)${s.time ? ', arriving ' + esc(s.time) : ''}.`}</p>
    <button id="send" class="big">Send my reply</button><p class="note" id="err"></p>`;
  if (s.i > 0) h += '<button id="bk" class="ghost" style="width:100%">Back</button>';
  el.innerHTML = h + '</div>';
}
el.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t || !inv) return;
  if (t.dataset.a) { s.status = t.dataset.a; s.i = 1; return draw(); }
  if (t.dataset.d) { const d = +t.dataset.d;
    if (t.dataset.f === 'count') { s.count = clamp(s.count + d, 1, 20); s.veg = Math.min(s.veg, s.count); } else s.veg = clamp(s.veg + d, 0, s.count);
    return draw(); }
  if (t.dataset.t) { s.time = t.dataset.t; s.i++; return draw(); }
  if (t.id === 'nx') { if (seq()[s.i] === 'time' && $('tm').value) s.time = $('tm').value; s.i++; return draw(); }
  if (t.id === 'bk') { s.i--; return draw(); }
  if (t.id === 'send') {
    t.disabled = true;
    const no = s.status === 'no';
    const { error } = await sb.rpc('submit_reply', { p_token: token, p_status: s.status, p_count: no ? 0 : s.count, p_veg: no ? 0 : s.veg, p_time: no ? '' : s.time });
    if (error) { t.disabled = false; $('err').textContent = 'Could not send. Please try again.'; return; }
    el.innerHTML = `<h1>Thank you!</h1><div class="panel"><p>Your reply is saved. The family can see it now.</p><p class="note">Plans changed? Open your link again and send a new reply.</p></div>`;
  }
});
start();
