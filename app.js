const sb = supabase.createClient(CFG.url, CFG.key);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let weddings = [], wedding = null, guests = [], timer = null, q = '', flt = 'all', bulk = '', impMsg = '';
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
    <div class="row"><button id="li">Log in</button><button id="su" class="ghost">Sign up</button><button id="fp" class="ghost">Forgot password?</button></div>
    <p class="note" id="msg">${esc(msg || '')}</p></div>`;
  const say = t => $('msg').textContent = t;
  $('fp').onclick = async () => {
    const email = $('em').value.trim();
    if (!email) return say('Type your email in the box above, then tap Forgot password? again.');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset.html' });
    say(error ? error.message : 'If this email has an account, a reset link is on its way. Check Inbox and Spam.');
  };
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
  return guests.filter(g => (flt === 'all' || (flt === 'unsent' ? (!g.invited_at && g.status === 'waiting') : g.status === flt)) && (!t || g.name.toLowerCase().includes(t) || (g.phone || '').includes(t)));
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
      <td class="row"><a class="wa" data-gid="${g.id}" target="_blank" rel="noopener" href="${wa(g)}">WhatsApp${g.invited_at ? ' ✓' : ''}</a>
      <button class="sm ghost" data-edit="${g.id}" aria-label="Edit ${esc(g.name)}">✎</button>
      <button class="sm ghost" data-del="${g.id}" aria-label="Remove ${esc(g.name)}">✕</button></td></tr>`;
  }).join('');
  return `<p class="note" style="margin:0 0 8px">Showing ${vis.length} of ${guests.length}</p><div class="scroll"><table><thead><tr><th>Guest</th><th>Status</th><th>People</th><th>Food</th><th>Arrives</th><th>Needs</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function cleanPhone(raw) {
  const s = String(raw == null ? '' : raw).trim(), plus = s.startsWith('+');
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  else if (d.length === 13 && d.startsWith('091')) d = d.slice(3);
  if (d.length === 10 && /^[6-9]/.test(d)) return d;
  if (plus && d.length >= 11 && d.length <= 15 && !d.startsWith('91')) return d;
  return null;
}
function parseCSV(t) {
  t = String(t).replace(/^\uFEFF/, '');
  const rows = []; let r = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t' || ch === ';') { r.push(c); c = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); rows.push(r); r = []; c = ''; }
    else c += ch;
  }
  if (c !== '' || r.length) { r.push(c); rows.push(r); }
  return rows;
}
function rowsToGuests(rows) {
  const out = [], bad = [];
  rows.forEach((cells, idx) => {
    cells = cells.map(c => String(c == null ? '' : c).trim());
    if (!cells.some(Boolean)) return;
    let phone = null, pi = -1;
    for (let i = 0; i < cells.length; i++) { if (/[A-Za-z\u0C00-\u0C7F]/.test(cells[i])) continue; const p = cleanPhone(cells[i]); if (p) { phone = p; pi = i; break; } }
    let name = cells.filter((c, i) => c && i !== pi).join(' ').trim();
    if (!phone && cells.length === 1) {
      const m = cells[0].match(/^(.*?)[\s:,-]*(\+?\d[\d\s-]{8,}\d)\s*$/);
      if (m) { phone = cleanPhone(m[2]); name = m[1].trim(); }
    }
    if (!phone) { if (idx === 0 && !cells.some(c => /\d/.test(c))) return; bad.push(cells.filter(Boolean).join(' | ')); return; }
    if (!name) name = 'Guest ' + phone.slice(-4);
    out.push({ name, phone });
  });
  return { out, bad };
}
function loadXLSX() {
  return new Promise((res, rej) => {
    if (window.XLSX) return res();
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload = res; sc.onerror = () => rej(new Error('load'));
    document.head.appendChild(sc);
  });
}
async function readFileRows(f) {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    await loadXLSX();
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  }
  return parseCSV(await f.text());
}
async function importRows(rows) {
  const { out, bad } = rowsToGuests(rows);
  const have = new Set(guests.map(g => String(g.phone || '').replace(/\D/g, '').slice(-10)));
  const fileSeen = new Set(), add = [];
  let dupList = 0, dupFile = 0;
  out.forEach(g => {
    const k = g.phone.slice(-10);
    if (have.has(k)) dupList++; else if (fileSeen.has(k)) dupFile++; else { fileSeen.add(k); add.push({ wedding_id: wedding.id, name: g.name, phone: g.phone }); }
  });
  for (let i = 0; i < add.length; i += 200) {
    const { error } = await sb.from('guests').insert(add.slice(i, i + 200));
    if (error) { impMsg = 'Could not save: ' + esc(error.message); return loadGuests(); }
  }
  let m = `<b>Added ${add.length} guests.</b>`;
  if (dupList + dupFile) m += ` Skipped ${dupList + dupFile} duplicate number${dupList + dupFile === 1 ? '' : 's'}.`;
  if (bad.length) m += ` ${bad.length} row${bad.length === 1 ? ' has' : 's have'} no valid number and ${bad.length === 1 ? 'was' : 'were'} skipped:<br>` + bad.slice(0, 15).map(esc).join('<br>') + (bad.length > 15 ? '<br>…' : '');
  if (!add.length && !bad.length && !dupList && !dupFile) m = 'No guests found. Put the name and the number in two columns.';
  impMsg = m; bulk = ''; await loadGuests();
}
function nextGuest() { return guests.find(g => !g.invited_at && g.status === 'waiting'); }
async function markSent(id) {
  const when = new Date().toISOString();
  const { error } = await sb.from('guests').update({ invited_at: when }).eq('id', id);
  if (error) { if (!window.__warnedSent) { window.__warnedSent = 1; alert('Could not save the “sent” mark. Please run the new Supabase code, then refresh this page.'); } return false; }
  const g = guests.find(x => x.id === id); if (g) g.invited_at = when;
  return true;
}
function sendPanel() {
  const total = guests.length;
  if (!total) return '';
  const sent = guests.filter(g => g.invited_at).length, nx = nextGuest();
  const left = guests.filter(g => !g.invited_at && g.status === 'waiting').length;
  return `<div class="panel"><h2>Send invites</h2>
    <p class="note" style="margin:0 0 6px;color:var(--ink)"><b>${sent}</b> of ${total} invites sent · ${left} still to send</p>
    <div class="bar" style="margin:6px 0 12px"><div style="width:${Math.round(sent / total * 100)}%"></div></div>
    <button id="nxt" ${nx ? '' : 'disabled'} style="width:100%;padding:14px;font-size:17px;${nx ? '' : 'opacity:.6'}">${nx ? '▶ Send to next: ' + esc(nx.name) : '✓ All invites sent'}</button>
    <p class="note">Tap the button, press Send in WhatsApp, come back here, and tap again. The list remembers who is done.</p></div>`;
}
function notesHTML() {
  const n = guests.filter(g => g.note && g.status !== 'no');
  if (!n.length) return '<p class="note" style="margin:0">No notes from guests yet.</p>';
  return '<p class="note" style="margin:0 0 6px">Notes from guests:</p>' + n.map(g => `<p style="margin:4px 0"><b>${esc(g.name)}:</b> ${esc(g.note)}</p>`).join('');
}
/* ---------- Caterer count ---------- */
function catRows() {
  return guests.map(g => {
    const rep = g.status === 'yes' || g.status === 'maybe';
    return [g.name, (LBL[g.status] || LBL.waiting)[0], rep ? g.veg : 0, rep ? Math.max(0, g.headcount - g.veg) : 0];
  });
}
function catSummary() {
  const s = stats();
  return [['Coming (people)', s.yes], ['Not coming (families)', s.no], ['Veg', s.veg], ['Non-veg', s.nonveg]];
}
function catererPanel() {
  if (!guests.length) return '';
  const s = stats();
  return `<div class="panel"><h2>Caterer count</h2>
    <div class="tiles" style="margin-bottom:10px">${tile('Coming (people)', s.yes, 'var(--teal)')}${tile('Not coming (families)', s.no, 'var(--red)')}${tile('Veg', s.veg, 'var(--pink)')}${tile('Non-veg', s.nonveg, 'var(--pink)')}</div>
    <div class="row"><button id="cdl">Download (Excel)</button><button id="cpr" class="ghost">Print / Save as PDF</button></div></div>`;
}
function csvCell(v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function downloadCaterer() {
  const rows = [['Wedding', wedding.name], ['Date', wedding.event_date || ''], [], ...catSummary(), [], ['Name', 'Reply', 'Veg', 'Non-veg'], ...catRows()];
  const text = '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = 'caterer-count-' + (wedding.name || 'wedding').replace(/[^a-z0-9]+/gi, '-') + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
}
function printCaterer() {
  if (!document.getElementById('printcss')) {
    const st = document.createElement('style'); st.id = 'printcss';
    st.textContent = '#printsheet{display:none}@media print{body.printing .wrap{display:none!important}body.printing #printsheet{display:block;color:#000;font-family:system-ui,sans-serif;padding:12px}#printsheet table{border-collapse:collapse;width:100%;margin-bottom:16px;font-size:14px}#printsheet th,#printsheet td{border:1px solid #999;padding:6px 8px;text-align:left}}';
    document.head.appendChild(st);
  }
  let el = document.getElementById('printsheet');
  if (!el) { el = document.createElement('div'); el.id = 'printsheet'; document.body.appendChild(el); }
  const sum = catSummary().map(r => `<tr><td>${esc(r[0])}</td><td><b>${esc(r[1])}</b></td></tr>`).join('');
  const body = catRows().map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  el.innerHTML = `<h2 style="margin:0 0 4px">${esc(wedding.name)}</h2><p style="margin:0 0 12px">${esc(wedding.event_date || '')}</p>
    <table style="width:auto"><tbody>${sum}</tbody></table>
    <table><thead><tr><th>Name</th><th>Reply</th><th>Veg</th><th>Non-veg</th></tr></thead><tbody>${body}</tbody></table>`;
  document.body.classList.add('printing');
  window.addEventListener('afterprint', () => document.body.classList.remove('printing'), { once: true });
  window.print();
}

/* ---------- Edit a guest ---------- */
function openEdit(id) {
  const g = guests.find(x => x.id === id); if (!g) return;
  const old = document.getElementById('eg_ov'); if (old) old.remove();
  const ov = document.createElement('div'); ov.id = 'eg_ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:14px;z-index:50';
  const lab = t => `<label style="display:block;margin:8px 0 3px;font-size:13px">${t}</label>`;
  ov.innerHTML = `<div class="panel" style="width:100%;max-width:420px;max-height:92vh;overflow:auto;margin:0">
    <h2 style="margin-top:0">Edit guest</h2>
    ${lab('Name')}<input id="eg_name" value="${esc(g.name)}">
    ${lab('WhatsApp number')}<input id="eg_phone" inputmode="tel" value="${esc(g.phone || '')}">
    ${lab('Reply')}<select id="eg_status"><option value="waiting">Waiting</option><option value="yes">Coming</option><option value="maybe">Maybe</option><option value="no">Not coming</option></select>
    ${lab('How many people (including children)')}<input id="eg_count" type="number" min="0" max="20" value="${g.headcount || 0}">
    ${lab('How many are children')}<input id="eg_kids" type="number" min="0" max="20" value="${g.kids || 0}">
    ${lab('How many eat veg')}<input id="eg_veg" type="number" min="0" max="20" value="${g.veg || 0}">
    ${lab('Arrival time')}<input id="eg_arr" value="${esc(g.arrival || '')}">
    ${lab('Note')}<input id="eg_note" value="${esc(g.note || '')}">
    <p class="note" id="eg_err" style="color:var(--red)"></p>
    <div class="row"><button id="eg_save">Save</button><button id="eg_cancel" class="ghost">Cancel</button></div></div>`;
  document.body.appendChild(ov);
  document.getElementById('eg_status').value = g.status || 'waiting';
  document.getElementById('eg_cancel').onclick = () => ov.remove();
  document.getElementById('eg_save').onclick = async () => {
    const err = t => document.getElementById('eg_err').textContent = t;
    const val = k => document.getElementById(k).value;
    const name = val('eg_name').trim(); if (!name) return err('Name cannot be empty.');
    const rawPhone = val('eg_phone').trim(); let phone = null;
    if (rawPhone) { phone = cleanPhone(rawPhone); if (!phone) return err('This number does not look right. Use a 10 digit number.'); }
    const count = parseInt(val('eg_count') || '0', 10), kids = parseInt(val('eg_kids') || '0', 10), veg = parseInt(val('eg_veg') || '0', 10);
    if ([count, kids, veg].some(n => isNaN(n) || n < 0 || n > 20)) return err('Numbers must be between 0 and 20.');
    if (kids > count) return err('Children cannot be more than the total people.');
    if (veg > count) return err('Veg cannot be more than the total people.');
    const status = val('eg_status');
    const upd = { name, phone, status, headcount: count, kids, veg, arrival: val('eg_arr').trim().slice(0, 30) || null, note: val('eg_note').trim() || null };
    if (status !== 'waiting') upd.replied_at = new Date().toISOString();
    const { error } = await sb.from('guests').update(upd).eq('id', id);
    if (error) return err('Could not save: ' + error.message);
    ov.remove(); loadGuests();
  };
}

function draw() {
  const s = stats();
  const ae = document.activeElement;
  const focusId = ae && (ae.id === 'srch' || ae.id === 'bulk') ? ae.id : null;
  const pos = focusId ? ae.selectionStart : 0;
  const cnt = k => k === 'all' ? guests.length : k === 'unsent' ? guests.filter(g => !g.invited_at && g.status === 'waiting').length : guests.filter(g => g.status === k).length;
  const chips = [['all','All'],['yes','Coming'],['maybe','Maybe'],['no','Not coming'],['waiting','Waiting'],['unsent','Not sent yet']]
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
      <p class="note" style="margin:14px 0 6px;color:var(--ink)"><b>Or upload a file</b> (Excel or CSV, with the name and the number in two columns):</p>
      <input id="gf" type="file" accept=".csv,.xlsx,.xls,.txt">
      ${impMsg ? `<div class="note" style="margin-top:10px;color:var(--ink)">${impMsg}</div>` : ''}
      <p class="note">Numbers are cleaned and duplicates are skipped automatically.</p></div>
    ${sendPanel()}
    ${catererPanel()}
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
  if (t.id === 'cdl') downloadCaterer();
  if (t.id === 'cpr') printCaterer();
  if (t.dataset && t.dataset.edit) openEdit(t.dataset.edit);
  if (t.id === 'ed') showCreate(true);
  if (t.dataset && t.dataset.del && confirm('Remove this guest?')) {
    await sb.from('guests').delete().eq('id', t.dataset.del); loadGuests();
  }
  if (t.id === 'ag') {
    const txt = $('bulk').value;
    if (!txt.trim()) return alert('Paste or type at least one guest.');
    await importRows(parseCSV(txt));
  }
  if (t.id === 'nxt') {
    const g = nextGuest(); if (!g) return;
    window.open(wa(g), '_blank');
    await markSent(g.id); draw();
  }
  const link = t.closest ? t.closest('a.wa') : null;
  if (link && link.dataset.gid) { markSent(link.dataset.gid).then(draw); }
});
document.addEventListener('change', async e => {
  if (e.target.id === 'gf') {
    const f = e.target.files[0]; if (!f) return;
    impMsg = 'Reading ' + esc(f.name) + '…'; draw();
    try { await importRows(await readFileRows(f)); }
    catch (err) { impMsg = 'Could not read this file. If it is an Excel file, open it and use Save As → CSV, then upload that.'; draw(); }
  }
  if (e.target.id === 'sel') { wedding = weddings.find(w => w.id === e.target.value); loadGuests(); }
});
init();
