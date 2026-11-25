const sb = supabase.createClient(CFG.url, CFG.key);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let weddings = [], wedding = null, guests = [], timer = null, q = '', flt = 'all', bulk = '';
const NEEDICON = { stay: '🏨', pickup: '🚗', food: '🥗', elders: '♿' };
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
const okPhoto = p => typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(p);
function shrink(file) {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onerror = rej;
    r.onload = () => {
      const im = new Image(); im.onerror = rej;
      im.onload = () => {
        let max = 900, q = 0.8, out; const c = document.createElement('canvas');
        for (let i = 0; i < 5; i++) {
          const k = Math.min(1, max / Math.max(im.width, im.height));
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length < 180000) break;
          max = Math.round(max * 0.8); q = Math.max(0.5, q - 0.08);
        }
        res(out);
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
function showCreate(edit) {
  clearInterval(timer);
  const w = edit ? wedding : {};
  const v = k => esc(w[k] || '');
  let photoData = okPhoto(w.photo) ? w.photo : null;
  $('app').innerHTML = `<div class="panel"><h2>${edit ? 'Edit invitation' : 'Create your wedding'}</h2>
    <p class="note" style="margin:0 0 10px">Guests see these details on their reply page.</p>
    <input id="wn" placeholder="Wedding name, for example: Anjali weds Rohan" value="${v('name')}" style="margin-bottom:8px">
    <input id="wd" type="date" aria-label="Wedding date" value="${v('event_date')}" style="margin-bottom:8px">
    <input id="wt" placeholder="Time, for example: 10:30 AM, Muhurtham 11:15 AM" value="${v('event_time')}" style="margin-bottom:8px">
    <input id="wv" placeholder="Venue, for example: Sri Lakshmi Function Hall, Hyderabad" value="${v('venue')}" style="margin-bottom:8px">
    <textarea id="wm" rows="5" placeholder="Invitation message (English and Telugu are both fine). For example: With the blessings of our elders, we invite you and your family to celebrate the wedding of our son...">${v('invite_message')}</textarea>
    <label for="wp" style="display:block;margin:10px 0 4px"><b>Couple or family photo (optional)</b></label><input id="wp" type="file" accept="image/*"><div id="pvw" style="margin-top:8px"></div>
    <div class="row" style="margin-top:10px"><button id="cw">${edit ? 'Save' : 'Create wedding'}</button>${weddings.length ? '<button id="cx" class="ghost">Cancel</button>' : ''}<button id="lo" class="ghost">Log out</button></div></div>`;
  $('lo').onclick = logout;
  if ($('cx')) $('cx').onclick = showApp;
  const pv = () => {
    $('pvw').innerHTML = photoData ? `<img src="${photoData}" alt="Photo preview" style="max-width:100%;max-height:220px;border-radius:12px;display:block"><button id="rp" type="button" class="ghost sm" style="margin-top:6px">Remove photo</button>` : '';
    if ($('rp')) $('rp').onclick = () => { photoData = null; $('wp').value = ''; pv(); };
  };
  pv();
  $('wp').onchange = async () => {
    const f = $('wp').files[0]; if (!f) return;
    try { photoData = await shrink(f); pv(); } catch (e) { alert('Could not read this photo. Please try another one.'); }
  };
  $('cw').onclick = async () => {
    const name = $('wn').value.trim(); if (!name) return alert('Type the wedding name.');
    const f = { name, event_date: $('wd').value || null, event_time: $('wt').value.trim() || null, venue: $('wv').value.trim() || null, invite_message: $('wm').value.trim() || null, photo: photoData };
    const { data, error } = await (edit ? sb.from('weddings').update(f).eq('id', wedding.id).select().single() : sb.from('weddings').insert(f).select().single());
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
  const s = { yes:0, maybe:0, no:0, wait:0, veg:0, nonveg:0, kids:0, stay:0, pickup:0, food:0, elders:0 };
  guests.forEach(g => {
    if (g.status !== 'no') (g.needs || '').split(',').forEach(k => { if (k in s) s[k]++; });
    if (g.status === 'yes') { s.yes += g.headcount; s.veg += g.veg; s.nonveg += g.headcount - g.veg; s.kids += g.kids || 0; }
    else if (g.status === 'maybe') s.maybe += g.headcount;
    else if (g.status === 'no') s.no++; else s.wait++;
  });
  s.plates = Math.ceil((s.yes + s.maybe * 0.5) * 1.05);
  return s;
}
const link = g => location.origin + '/r.html?t=' + g.token;
function wa(g) {
  const msg = `Namaste ${g.name}! You are invited to ${wedding.name}${wedding.event_date ? ' on ' + wedding.event_date : ''}. Please tap the link below to reply (20 seconds).\n\nనమస్తే ${g.name}! ${wedding.name} కి మీకు ఆహ్వానం. దయచేసి కింది లింక్ తెరిచి సమాధానం ఇవ్వండి (20 సెకన్లు).\n\n${link(g)}`;
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
      <td>${rep ? g.headcount + ((g.kids || 0) ? ' (' + g.kids + ' kids)' : '') : '–'}</td><td>${g.status === 'yes' ? g.veg + ' veg / ' + (g.headcount - g.veg) + ' non-veg' : '–'}</td>
      <td>${esc(g.arrival || '–')}</td>
      <td title="${esc(g.note || '')}">${(g.needs || '').split(',').map(k => NEEDICON[k] || '').join(' ') || '–'}${g.note ? ' 💬' : ''}</td>
      <td class="row"><a class="wa" target="_blank" rel="noopener" href="${wa(g)}">WhatsApp</a>
      <button class="sm ghost" data-del="${g.id}" aria-label="Remove ${esc(g.name)}">✕</button></td></tr>`;
  }).join('');
  return `<p class="note" style="margin:0 0 8px">Showing ${vis.length} of ${guests.length}</p><div class="scroll"><table><thead><tr><th>Guest</th><th>Status</th><th>People</th><th>Food</th><th>Arrives</th><th>Needs</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function notesHTML() {
  const n = guests.filter(g => g.note && g.status !== 'no');
  if (!n.length) return '<p class="note" style="margin:0">No notes from guests yet.</p>';
  return '<p class="note" style="margin:0 0 6px">Notes from guests:</p>' + n.map(g => `<p style="margin:4px 0"><b>${esc(g.name)}:</b> ${esc(g.note)}</p>`).join('');
}
function draw() {
  const s = stats();
  const ae = document.activeElement;
  const focusId = ae && (ae.id === 'srch' || ae.id === 'bulk') ? ae.id : null;
  const pos = focusId ? ae.selectionStart : 0;
  const cnt = k => k === 'all' ? guests.length : guests.filter(g => g.status === k).length;
  const chips = [['all','All'],['yes','Coming'],['maybe','Maybe'],['no','Not coming'],['waiting','Waiting']]
    .filter(([k]) => k !== 'maybe' || s.maybe > 0).map(([k, n]) => `<button class="sm ${flt === k ? '' : 'ghost'}" data-flt="${k}">${n} (${cnt(k)})</button>`).join('');
  $('app').innerHTML = `
    <div class="row" style="margin-bottom:12px"><select id="sel" aria-label="Wedding" style="flex:1">${weddings.map(w => `<option value="${w.id}" ${w.id === wedding.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>
      <button id="ed" class="ghost">Edit invitation</button><button id="nw" class="ghost">New wedding</button><button id="rf" class="ghost">Refresh</button><button id="lo" class="ghost">Log out</button></div>
    <div class="hero"><b>${s.plates}</b>plates to tell the caterer (${s.maybe ? 'coming + half of maybe' : 'everyone coming'}, plus 5% extra). You invited ${guests.length} families.<br>Coming: ${s.yes - s.kids} adults and ${s.kids} children.</div>
    <div class="tiles">${tile('Coming', s.yes, 'var(--teal)')}${tile('Adults', s.yes - s.kids, 'var(--teal)')}${tile('Children', s.kids, '#8e44ad')}${s.maybe ? tile('Maybe', s.maybe, 'var(--gold)') : ''}${tile('Not coming (families)', s.no, 'var(--red)')}${tile('Waiting (families)', s.wait, 'var(--mute)')}${tile('Veg', s.veg, 'var(--pink)')}${tile('Non-veg', s.nonveg, 'var(--pink)')}</div>
    <div class="panel"><h2>What guests need from you</h2>
      <div class="tiles" style="margin-bottom:8px">${tile('🚗 Need pickup (families)', s.pickup, 'var(--pink)')}${tile('♿ Elders help (families)', s.elders, 'var(--pink)')}</div>
      ${notesHTML()}</div>
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
  if (t.id === 'ed') showCreate(true);
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
