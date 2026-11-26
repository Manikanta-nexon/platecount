const sb = supabase.createClient(CFG.url, CFG.key);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Telugu font and style, added from this file so no other file needs to change
const tf = document.createElement('link'); tf.rel = 'stylesheet';
tf.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600;700&family=Playfair+Display:ital,wght@0,700;0,800;1,600&family=Poppins:wght@400;500;600&display=swap';
document.head.appendChild(tf);
const st = document.createElement('style');
st.textContent = '.te{display:block;font-family:"Noto Sans Telugu","Nirmala UI",system-ui,sans-serif;font-size:.88em;font-weight:500;opacity:.92;margin-top:2px}';
document.head.appendChild(st);

const PAL = {
  emerald: { pink: '#0b5d4b', te: '#307566', gold: '#c9962b', ink: '#12332b', mute: '#4f6b62', line: '#cfe3d6', bg: '#f3faf5', bg2: '#dcefe3', card: '#fcfffd', card2: '#eef8f1', bar: '#d3e7da', out: '#bcdcc8', msg: '#21443a', sh: '11,93,75' },
  maroon: { pink: '#8b1538', te: '#a74d68', gold: '#c9962b', ink: '#3b1020', mute: '#7a5a4a', line: '#ead7a6', bg: '#fff8ec', bg2: '#fcebc9', card: '#fffdf7', card2: '#fff6df', bar: '#f1e2bd', out: '#e6cf92', msg: '#4a2a36', sh: '139,21,56' },
  royal: { pink: '#1f3c88', te: '#4e65a1', gold: '#c9962b', ink: '#131c3b', mute: '#56608a', line: '#d3d9ee', bg: '#f5f7ff', bg2: '#e0e6fa', card: '#fdfdff', card2: '#eef1fc', bar: '#d6ddf3', out: '#c3cdee', msg: '#25305a', sh: '31,60,136' },
  rose: { pink: '#b03a6e', te: '#b13c6f', gold: '#c28f2c', ink: '#3a1a2a', mute: '#86607a', line: '#f1d3e0', bg: '#fff5f9', bg2: '#fde1ec', card: '#fffafc', card2: '#ffeef5', bar: '#f6d6e3', out: '#eebfd2', msg: '#4a2a3c', sh: '176,58,110' },
  saffron: { pink: '#a8360a', te: '#b04820', gold: '#b8860b', ink: '#3b1d0e', mute: '#7a5a46', line: '#f1d9bd', bg: '#fff7ed', bg2: '#fde4c8', card: '#fffdf9', card2: '#fff1df', bar: '#f8dcc0', out: '#f1c79a', msg: '#4a2a16', sh: '194,65,12' }
};
const gs = document.createElement('style');
document.head.appendChild(gs);
function applyPalette(name) {
  const p = PAL[name] || PAL.emerald;
  gs.textContent = `
:root{--te:${p.te};--bg:${p.bg};--card:${p.card};--ink:${p.ink};--mute:${p.mute};--line:${p.line};--pink:${p.pink};--gold:${p.gold};color-scheme:light}
body{font-family:'Poppins',system-ui,sans-serif;background:linear-gradient(180deg,${p.bg} 0%,${p.bg2} 100%);min-height:100vh}
h1,h2{font-family:'Playfair Display',Georgia,serif;color:var(--pink);font-weight:800;line-height:1.25}
.panel p,.panel label,.note{color:var(--ink);font-weight:600}
.te{color:var(--te);font-weight:500;opacity:1}
button:not(.ghost) .te{color:rgba(255,255,255,.88)}
button.ghost .te{color:var(--te)}
.panel{background:var(--card);border:1px solid var(--line);box-shadow:0 4px 16px rgba(${p.sh},.10)}
.bar{background:${p.bar}}.bar div{background:linear-gradient(90deg,${p.gold},${p.pink})}
button.ghost{border:1.5px solid var(--gold);color:var(--pink);background:transparent}
.inv{border:2px solid var(--gold);outline:1px solid ${p.out};outline-offset:-9px;border-radius:20px;padding:26px 20px 24px;background:linear-gradient(180deg,${p.card},${p.card2})}
.inv h1{font-size:clamp(28px,8vw,36px);margin:8px 0 12px}
.inv .orn{color:var(--gold);letter-spacing:8px;font-size:15px;margin:2px 0}
.inv .dt{margin:5px 0;font-weight:600;color:var(--ink)}
.inv .msg{white-space:pre-line;margin:16px 0 0;line-height:1.75;color:${p.msg}}
.inv img{border:3px solid var(--gold);box-shadow:0 6px 18px rgba(${p.sh},.20)}
`;
}
applyPalette('emerald');
const T = (en, te) => `${en}<span class="te">${te}</span>`;
const fdate = d => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } };
const okPhoto = p => typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(p);
const TEL = { Morning: 'ఉదయం', Afternoon: 'మధ్యాహ్నం', Evening: 'సాయంత్రం' };

const token = new URLSearchParams(location.search).get('t');
const el = $('app');
const BAD = `<h1>${T('Link not valid', 'లింక్ చెల్లదు')}</h1><p>${T('Please ask the family to send your link again.', 'దయచేసి కుటుంబాన్ని మీ లింక్ మళ్లీ పంపమని అడగండి.')}</p>`;
let inv = null, s = { i: 0, status: '', count: 1, kids: 0, veg: 1, time: '', needs: [], note: '' };
const NEEDS = [['pickup', '🚗', 'I need a pickup (station or airport)', 'నాకు పికప్ కావాలి (స్టేషన్ లేదా ఎయిర్‌పోర్ట్)', 'Pickup', 'పికప్'], ['elders', '♿', 'Help for elders or wheelchair', 'పెద్దలకు లేదా వీల్‌చైర్‌కు సహాయం', 'Elders help', 'పెద్దలకు సహాయం']];
const seq = () => s.status === 'no' ? ['who', 'sum'] : s.count > 1 ? ['who', 'count', 'kids', 'food', 'time', 'help', 'sum'] : ['who', 'count', 'food', 'time', 'help', 'sum'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const stepper = (f, v) => `<div class="stp"><button data-d="-1" data-f="${f}" aria-label="Less">−</button><b>${v}</b><button data-d="1" data-f="${f}" aria-label="More">+</button></div>`;

async function start() {
  if (!token) return el.innerHTML = BAD;
  const { data, error } = await sb.rpc('get_invite', { p_token: token });
  if (error || !data || !data.length) return el.innerHTML = BAD;
  inv = data[0]; draw();
}
function draw() {
  const q = seq(), k = q[s.i], g = esc(inv.guest_name);
  const lines = [];
  if (inv.event_date) lines.push('📅 ' + esc(fdate(inv.event_date)));
  if (inv.event_time) lines.push('⏰ ' + esc(inv.event_time));
  if (inv.venue) lines.push('📍 ' + esc(inv.venue));
  const head = s.i === 0
    ? `<div class="panel inv" style="text-align:center;margin-bottom:14px">${okPhoto(inv.photo) ? `<img src="${inv.photo}" alt="Photo of the family" style="width:100%;max-height:340px;object-fit:cover;border-radius:14px;margin-bottom:12px">` : ''}<div class="orn">✦ ✦ ✦</div><p class="note" style="margin:0;letter-spacing:1px">${T('You are invited to', 'మీకు ఆహ్వానం')}</p><h1>${esc(inv.wedding_name)}</h1><div class="orn">✦</div>${lines.map(l => `<p class="dt">${l}</p>`).join('')}${inv.invite_message ? `<p class="msg">${esc(inv.invite_message)}</p>` : ''}</div>`
    : `<h1>${esc(inv.wedding_name)}</h1><p class="note">${lines.join(' · ')}</p>`;
  let h = head + `<div class="bar"><div style="width:${Math.round((s.i + 1) / q.length * 100)}%"></div></div><div class="panel">`;
  if (k === 'who') h += `<h2>${T('Namaste ' + g + ', will you come?', 'నమస్తే ' + g + ', మీరు వస్తారా?')}</h2>
    <button data-a="yes" class="big">${T('Yes, I’ll be there', 'అవును, నేను వస్తాను')}</button>
    <button data-a="no" class="big ghost">${T('Sorry, can’t come', 'క్షమించండి, రాలేను')}</button>`;
  if (k === 'count') h += `<h2>${T('How many people are coming?', 'ఎంత మంది వస్తున్నారు?')}</h2>
    <p class="note">${T('Count everyone in your family, including you.', 'మీతో సహా మీ కుటుంబంలో అందరినీ లెక్కించండి.')}</p>${stepper('count', s.count)}
    <button id="nx" class="big">${T('Next', 'తరువాత')}</button>`;
  if (k === 'kids') h += `<h2>${T('How many of them are children?', 'వారిలో ఎంత మంది పిల్లలు?')}</h2>
    <p class="note">${T('Children below 10 years. Enter 0 if none.', '10 సంవత్సరాల లోపు పిల్లలు. లేకపోతే 0 పెట్టండి.')}</p>${stepper('kids', s.kids)}
    <p style="text-align:center">${T((s.count - s.kids) + ' adults and ' + s.kids + ' children', (s.count - s.kids) + ' పెద్దలు, ' + s.kids + ' పిల్లలు')}</p>
    <button id="nx" class="big">${T('Next', 'తరువాత')}</button>`;
  if (k === 'food') h += `<h2>${T('How many of them eat veg?', 'వారిలో ఎంత మంది వెజ్ (శాకాహారం) తింటారు?')}</h2>
    <p class="note">${T('Out of ' + s.count + ' people. The rest get non-veg.', s.count + ' మందిలో. మిగతావారికి నాన్-వెజ్.')}</p>${stepper('veg', s.veg)}
    <p style="text-align:center">${T(s.veg + ' veg and ' + (s.count - s.veg) + ' non-veg', s.veg + ' వెజ్, ' + (s.count - s.veg) + ' నాన్-వెజ్')}</p>
    <button id="nx" class="big">${T('Next', 'తరువాత')}</button>`;
  if (k === 'time') h += `<h2>${T('When will you arrive?', 'మీరు ఎప్పుడు వస్తారు?')}</h2>
    <button data-t="Morning" class="big ghost">${T('Morning', 'ఉదయం')}</button>
    <button data-t="Afternoon" class="big ghost">${T('Afternoon', 'మధ్యాహ్నం')}</button>
    <button data-t="Evening" class="big ghost">${T('Evening', 'సాయంత్రం')}</button>
    <label for="tm"><b>${T('Or pick an exact time', 'లేదా ఖచ్చితమైన సమయం ఎంచుకోండి')}</b></label><input id="tm" type="time" style="margin:4px 0 12px">
    <button id="nx" class="big">${T('Next', 'తరువాత')}</button>`;
  if (k === 'help') h += `<h2>${T('Anything the family should prepare?', 'కుటుంబం ఏమైనా సిద్ధం చేయాలా?')}</h2>
    <p class="note">${T('Tap all that apply. You can skip this page.', 'వర్తించేవి అన్నీ నొక్కండి. ఈ పేజీని దాటవేయవచ్చు.')}</p>
    ${NEEDS.map(n => `<button data-n="${n[0]}" class="big${s.needs.includes(n[0]) ? '' : ' ghost'}">${s.needs.includes(n[0]) ? '✓ ' : ''}${n[1]} ${T(n[2], n[3])}</button>`).join('')}
    <label for="nt"><b>${T('Anything else the family should know? (optional)', 'కుటుంబానికి తెలియజేయాల్సింది ఏదైనా? (ఐచ్ఛికం)')}</b></label>
    <textarea id="nt" rows="3" maxlength="200" style="margin:4px 0 12px" placeholder="">${esc(s.note)}</textarea>
    <button id="nx" class="big">${T('Next', 'తరువాత')}</button>`;
  if (k === 'sum') {
    const tm = s.time ? esc(s.time) : '', tmTe = s.time ? esc(TEL[s.time] || s.time) : '';
    const body = s.status === 'no'
      ? T('Sorry you can’t come. The family will miss you.', 'మీరు రాలేకపోతున్నందుకు విచారం. కుటుంబం మిమ్మల్ని మిస్ అవుతుంది.')
      : T(`You are ${s.status === 'yes' ? 'coming' : 'maybe coming'} with ${s.count} people (${s.kids ? s.kids + ' children, ' : ''}${s.veg} veg, ${s.count - s.veg} non-veg)${tm ? ', arriving ' + tm : ''}.`,
          `మీరు ${s.count} మందితో ${s.status === 'yes' ? 'వస్తున్నారు' : 'రావచ్చు'} (${s.kids ? s.kids + ' పిల్లలు, ' : ''}${s.veg} వెజ్, ${s.count - s.veg} నాన్-వెజ్)${tmTe ? ', ' + tmTe + ' కి వస్తారు' : ''}.`);
    const chosen = NEEDS.filter(n => s.needs.includes(n[0]));
    const needsLine = s.status !== 'no' && chosen.length ? `<p>${T('You asked for: ' + chosen.map(n => n[1] + ' ' + n[4]).join(', '), 'మీరు అడిగినవి: ' + chosen.map(n => n[1] + ' ' + n[5]).join(', '))}</p>` : '';
    h += `<h2>${T('Check your reply', 'మీ సమాధానం చూడండి')}</h2><p>${body}</p>${needsLine}
      <button id="send" class="big">${T('Send my reply', 'నా సమాధానం పంపండి')}</button><p class="note" id="err"></p>`;
  }
  if (s.i > 0) h += `<button id="bk" class="ghost" style="width:100%">${T('Back', 'వెనుకకు')}</button>`;
  el.innerHTML = h + '</div>';
}
el.addEventListener('input', e => { if (e.target.id === 'nt') s.note = e.target.value; });
el.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t || !inv) return;
  if (t.dataset.a) { s.status = t.dataset.a; s.i = 1; return draw(); }
  if (t.dataset.d) { const d = +t.dataset.d;
    if (t.dataset.f === 'count') { s.count = clamp(s.count + d, 1, 20); s.veg = Math.min(s.veg, s.count); s.kids = Math.min(s.kids, Math.max(0, s.count - 1)); } else if (t.dataset.f === 'kids') s.kids = clamp(s.kids + d, 0, Math.max(0, s.count - 1)); else s.veg = clamp(s.veg + d, 0, s.count);
    return draw(); }
  if (t.dataset.t) { s.time = t.dataset.t; s.i++; return draw(); }
  if (t.dataset.n) { const x = t.dataset.n, at = s.needs.indexOf(x); if (at >= 0) s.needs.splice(at, 1); else s.needs.push(x); return draw(); }
  if (t.id === 'nx') { if (seq()[s.i] === 'time' && $('tm').value) s.time = $('tm').value; s.i++; return draw(); }
  if (t.id === 'bk') { s.i--; return draw(); }
  if (t.id === 'send') {
    t.disabled = true;
    const no = s.status === 'no';
    const { error } = await sb.rpc('submit_reply', { p_token: token, p_status: s.status, p_count: no ? 0 : s.count, p_veg: no ? 0 : s.veg, p_time: no ? '' : s.time, p_kids: no ? 0 : s.kids, p_needs: no ? '' : s.needs.join(','), p_note: no ? '' : s.note.trim().slice(0, 200) });
    if (error) { t.disabled = false; $('err').innerHTML = T('Could not send. Please try again.', 'పంపలేకపోయాము. మళ్లీ ప్రయత్నించండి.'); return; }
    el.innerHTML = `<h1>${T('Thank you!', 'ధన్యవాదాలు!')}</h1><div class="panel"><p>${T('Your reply is saved. The family can see it now.', 'మీ సమాధానం సేవ్ అయింది. కుటుంబం ఇప్పుడు చూడగలరు.')}</p><p class="note">${T('Plans changed? Open your link again and send a new reply.', 'ప్లాన్ మారిందా? మీ లింక్ మళ్లీ తెరిచి కొత్త సమాధానం పంపండి.')}</p></div>`;
  }
});
start();
