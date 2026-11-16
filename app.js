const sb = supabase.createClient(CFG.url, CFG.key);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let weddings = [], wedding = null, guests = [], timer = null, q = '', flt = 'all', bulk = '';
const LBL = {yes:['Coming','var(--teal)'], maybe:['Maybe','var(--gold)'], no:['Not coming','var(--red)'], waiting:['Waiting','var(--mute)']};

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  session ? showApp() : showLogin();
}
function showLogin(msg) {
  clearInterval(timer);
  $('app').innerHTML = `<div class="panel"><h2>Host login</h2>
    <p class="note">New here? Type your email and a password, then tap Sign up.</p>
    <input id="em" type="email" placeholder="Email" autocomplete="email" style="margin:8px 0">
    <input id="pw" type="password" placeholder="Password (6+ letters)" autocomplete="current-password" style="margin-bottom:10px">
    <div class="row"><button id="li">Log in</button><button id="su" class="ghost">Sign up</button></div>
    <p class="note" id="msg">${esc(msg || '')}</p></div>`;
  const say = t => $('msg').textContent = t;
  $('li').onclick = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $('em').value.trim(), password: $('pw').value });
    error ? say(error.message) : showApp();
  };
  $('su').onclick = async () => {
    const { data, error } = await sb.auth.signUp({ email: $('em').value.trim(), password: $('pw').value });
    if (error) return say(error.message);
    data.session ? showApp() : say('Check your email, tap the confirm link, then log in.');
  };
}
async function showApp() {
  const { data, error } = await sb.from('weddings').select('*').order('created_at');
  if (error) return showLogin(error.message);
  weddings = data;
  if (!weddings.length) return showCreate();
  if (!wedding || !weddings.find(w => w.id === wedding.id)) wedding = weddings[0];
  await loadGuests();
  clearInterval(timer); timer = setInterval(loadGuests, 20000);
}
function showCreate() {
  clearInterval(timer);
  $('app').innerHTML = `<div class="panel"><h2>Create your wedding</h2>
    <input id="wn" placeholder="For example: Anjali weds Rohan" style="margin-bottom:8px">
    <input id="wd" type="date" aria-label="Wedding date" style="margin-bottom:10px">
    <button id="cw">Create wedding</button> <button id="lo" class="ghost">Log out</button></div>`;
  $('lo').onclick = logout;
  $('cw').onclick = async () => {
    const name = $('wn').value.trim(); if (!name) return alert('Type the wedding name.');
    const { data, error } = await sb.from('weddings').insert({ name, event_date: $('wd').value || null }).select().single();
    if (error) return alert(error.message);
    wedding = data; showApp();
  };
}
async function logout() { await sb.auth.signOut(); wedding = null; showLogin(); }
async function loadGuests() {
  const { data, error } = await sb.from('guests').select('*').eq('wedding_id', wedding.id).order('name');
  if (error) return alert(error.message);
  guests = data; draw();
}
function stats() {
  const s = { yes:0, maybe:0, no:0, wait:0, veg:0, nonveg:0 };
  guests.forEach(g => {
    if (g.status === 'yes') { s.yes += g.headcount; s.veg += g.veg; s.nonveg += g.headcount - g.veg; }
    else if (g.status === 'maybe') s.maybe += g.headcount;
    else if (g.status === 'no') s.no++; else s.wait++;
  });
  s.plates = Math.ceil((s.yes + s.maybe * 0.5) * 1.05);
  return s;
}
const link = g => location.origin + '/r.html?t=' + g.token;
function wa(g) {
  const msg = `Namaste ${g.name}! You are invited to ${wedding.name}${wedding.event_date ? ' on ' + wedding.event_date : ''}. Please tap this link to reply (20 seconds): ${link(g)}`;
  const d = (g.phone || '').replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${encodeURIComponent(msg)}`;
}
function tile(l, n, c) { return `<div class="tile" style="--c:${c}"><b>${n}</b><span>${l}</span></div>`; }
function visible() {
  const t = q.trim().toLowerCase();
  return guests.filter(g => (flt === 'all' || g.status === flt) && (!t || g.name.toLowerCase().includes(t) || (g.phone || '').includes(t)));
}
function listHTML() {
  if (!guests.length) return '<p class="note">No guests yet. Add your first families above.</p>';
  const vis = visible();
  if (!vis.length) return '<p class="note">No guest matches. Try a different name or filter.</p>';
  const rows = vis.map(g => {
    const l = LBL[g.status] || LBL.waiting, rep = g.status === 'yes' || g.status === 'maybe';
    return `<tr><td>${esc(g.name)}</td><td><span class="pill" style="--c:${l[1]}">${l[0]}</span></td>
      <td>${rep ? g.headcount : '–'}</td><td>${g.status === 'yes' ? g.veg + ' veg / ' + (g.headcount - g.veg) + ' non-veg' : '–'}</td>
      <td>${esc(g.arrival || '–')}</td>
      <td class="row"><a class="wa" target="_blank" rel="noopener" href="${wa(g)}">WhatsApp</a>
      <button class="sm ghost" data-del="${g.id}" aria-label="Remove ${esc(g.name)}">✕</button></td></tr>`;
  }).join('');
  return `<p class="note" style="margin:0 0 8px">Showing ${vis.length} of ${guests.length}</p><div class="scroll"><table><thead><tr><th>Guest</th><th>Status</th><th>People</th><th>Food</th><th>Arrives</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function draw() {
  const s = stats();
  const ae = document.activeElement;
  const focusId = ae && (ae.id === 'srch' || ae.id === 'bulk') ? ae.id : null;
  const pos = focusId ? ae.selectionStart : 0;
  const cnt = k => k === 'all' ? guests.length : guests.filter(g => g.status === k).length;
  const chips = [['all','All'],['yes','Coming'],['maybe','Maybe'],['no','Not coming'],['waiting','Waiting']]
    .map(([k, n]) => `<button class="sm ${flt === k ? '' : 'ghost'}" data-flt="${k}">${n} (${cnt(k)})</button>`).join('');
  $('app').innerHTML = `
    <div class="row" style="margin-bottom:12px"><select id="sel" aria-label="Wedding" style="flex:1">${weddings.map(w => `<option value="${w.id}" ${w.id === wedding.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>
      <button id="nw" class="ghost">New wedding</button><button id="rf" class="ghost">Refresh</button><button id="lo" class="ghost">Log out</button></div>
    <div class="hero"><b>${s.plates}</b>plates to tell the caterer (coming + half of maybe, plus 5% extra). You invited ${guests.length} families.</div>
    <div class="tiles">${tile('Coming', s.yes, 'var(--teal)')}${tile('Maybe', s.maybe, 'var(--gold)')}${tile('Not coming (families)', s.no, 'var(--red)')}${tile('Waiting (families)', s.wait, 'var(--mute)')}${tile('Veg', s.veg, 'var(--pink)')}${tile('Non-veg', s.nonveg, 'var(--pink)')}</div>
    <div class="panel"><h2>Add guests</h2>
      <textarea id="bulk" rows="4" placeholder="One family per line: name, WhatsApp number&#10;Sharma Uncle, 9876543210&#10;Priya Aunty, 9876500003">${esc(bulk)}</textarea>
      <div class="row" style="margin-top:8px"><button id="ag">Add guests</button></div>
      <p class="note">Then tap WhatsApp next to each name. Every guest gets their own private reply link. Replies show up here by themselves.</p></div>
    <div class="panel"><h2>Guest list</h2>
      <input id="srch" type="search" placeholder="Search by name or number" aria-label="Search guests" value="${esc(q)}" style="margin-bottom:10px">
      <div class="row" style="margin-bottom:12px">${chips}</div>
      <div id="list">${listHTML()}</div></div>`;
  if (focusId) { const i = $(focusId); i.focus(); i.setSelectionRange(pos, pos); }
}
document.addEventListener('input', e => {
  if (e.target.id === 'srch') { q = e.target.value; $('list').innerHTML = listHTML(); }
  if (e.target.id === 'bulk') bulk = e.target.value;
});
document.addEventListener('click', async e => {
  const t = e.target;
  if (t.id === 'lo') logout();
  if (t.id === 'rf') loadGuests();
  if (t.dataset && t.dataset.flt) { flt = t.dataset.flt; draw(); }
  if (t.id === 'nw') showCreate();
  if (t.dataset && t.dataset.del && confirm('Remove this guest?')) {
    await sb.from('guests').delete().eq('id', t.dataset.del); loadGuests();
  }
  if (t.id === 'ag') {
    const rowsIn = $('bulk').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const p = l.split(/[,\t]/); return { wedding_id: wedding.id, name: p[0].trim(), phone: (p[1] || '').trim() };
    }).filter(r => r.name);
    if (!rowsIn.length) return alert('Type at least one guest.');
    const { error } = await sb.from('guests').insert(rowsIn);
    error ? alert(error.message) : (bulk = '', loadGuests());
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'sel') { wedding = weddings.find(w => w.id === e.target.value); loadGuests(); }
});
init();
