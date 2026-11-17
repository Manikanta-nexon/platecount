const sb = supabase.createClient(CFG.url, CFG.key);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Telugu font and style, added from this file so no other file needs to change
const tf = document.createElement('link'); tf.rel = 'stylesheet';
tf.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600;700&display=swap';
document.head.appendChild(tf);
const st = document.createElement('style');
st.textContent = '.te{display:block;font-family:"Noto Sans Telugu","Nirmala UI",system-ui,sans-serif;font-size:.88em;font-weight:500;opacity:.92;margin-top:2px}';
document.head.appendChild(st);
const T = (en, te) => `${en}<span class="te">${te}</span>`;
const fdate = d => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } };
const okPhoto = p => typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(p);
const TEL = { Morning: 'ఉదయం', Afternoon: 'మధ్యాహ్నం', Evening: 'సాయంత్రం' };

const token = new URLSearchParams(location.search).get('t');
const el = $('app');
const BAD = `<h1>${T('Link not valid', 'లింక్ చెల్లదు')}</h1><p>${T('Please ask the family to send your link again.', 'దయచేసి కుటుంబాన్ని మీ లింక్ మళ్లీ పంపమని అడగండి.')}</p>`;
let inv = null, s = { i: 0, status: '', count: 1, veg: 1, time: '' };
const seq = () => s.status === 'no' ? ['who', 'sum'] : ['who', 'count', 'food', 'time', 'sum'];
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
    ? `<div class="panel" style="text-align:center;margin-bottom:14px">${okPhoto(inv.photo) ? `<img src="${inv.photo}" alt="Photo of the family" style="width:100%;max-height:340px;object-fit:cover;border-radius:14px;margin-bottom:12px">` : ''}<p class="note" style="margin:0">${T('You are invited to', 'మీకు ఆహ్వానం')}</p><h1 style="margin:6px 0 10px">${esc(inv.wedding_name)}</h1>${lines.map(l => `<p style="margin:4px 0;font-weight:600">${l}</p>`).join('')}${inv.invite_message ? `<p style="white-space:pre-line;margin:14px 0 0;text-align:left">${esc(inv.invite_message)}</p>` : ''}</div>`
    : `<h1>${esc(inv.wedding_name)}</h1><p class="note">${lines.join(' · ')}</p>`;
  let h = head + `<div class="bar"><div style="width:${Math.round((s.i + 1) / q.length * 100)}%"></div></div><div class="panel">`;
  if (k === 'who') h += `<h2>${T('Namaste ' + g + ', will you come?', 'నమస్తే ' + g + ', మీరు వస్తారా?')}</h2>
    <button data-a="yes" class="big">${T('Yes, I’ll be there', 'అవును, నేను వస్తాను')}</button>
    <button data-a="maybe" class="big ghost">${T('Maybe', 'రావచ్చు')}</button>
    <button data-a="no" class="big ghost">${T('Sorry, can’t come', 'క్షమించండి, రాలేను')}</button>`;
  if (k === 'count') h += `<h2>${T('How many people are coming?', 'ఎంత మంది వస్తున్నారు?')}</h2>
    <p class="note">${T('Count everyone in your family, including you.', 'మీతో సహా మీ కుటుంబంలో అందరినీ లెక్కించండి.')}</p>${stepper('count', s.count)}
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
  if (k === 'sum') {
    const tm = s.time ? esc(s.time) : '', tmTe = s.time ? esc(TEL[s.time] || s.time) : '';
    const body = s.status === 'no'
      ? T('Sorry you can’t come. The family will miss you.', 'మీరు రాలేకపోతున్నందుకు విచారం. కుటుంబం మిమ్మల్ని మిస్ అవుతుంది.')
      : T(`You are ${s.status === 'yes' ? 'coming' : 'maybe coming'} with ${s.count} people (${s.veg} veg, ${s.count - s.veg} non-veg)${tm ? ', arriving ' + tm : ''}.`,
          `మీరు ${s.count} మందితో ${s.status === 'yes' ? 'వస్తున్నారు' : 'రావచ్చు'} (${s.veg} వెజ్, ${s.count - s.veg} నాన్-వెజ్)${tmTe ? ', ' + tmTe + ' కి వస్తారు' : ''}.`);
    h += `<h2>${T('Check your reply', 'మీ సమాధానం చూడండి')}</h2><p>${body}</p>
      <button id="send" class="big">${T('Send my reply', 'నా సమాధానం పంపండి')}</button><p class="note" id="err"></p>`;
  }
  if (s.i > 0) h += `<button id="bk" class="ghost" style="width:100%">${T('Back', 'వెనుకకు')}</button>`;
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
    if (error) { t.disabled = false; $('err').innerHTML = T('Could not send. Please try again.', 'పంపలేకపోయాము. మళ్లీ ప్రయత్నించండి.'); return; }
    el.innerHTML = `<h1>${T('Thank you!', 'ధన్యవాదాలు!')}</h1><div class="panel"><p>${T('Your reply is saved. The family can see it now.', 'మీ సమాధానం సేవ్ అయింది. కుటుంబం ఇప్పుడు చూడగలరు.')}</p><p class="note">${T('Plans changed? Open your link again and send a new reply.', 'ప్లాన్ మారిందా? మీ లింక్ మళ్లీ తెరిచి కొత్త సమాధానం పంపండి.')}</p></div>`;
  }
});
start();
