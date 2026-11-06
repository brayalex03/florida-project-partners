(function () {
  'use strict';

  var C = window.FPP_CONFIG;
  var PROFS = ['General Contractor', 'Contratista', 'Prestamista', 'Realtor', 'Arquitecto', 'Inversionista', 'Proveedor'];
  var TYPES = ['Proyecto', 'Trabajo realizado', 'Oportunidad'];
  var TYPE_COLORS = {
    'Proyecto': { bg: '#DDF0EE', fg: '#0B5653' },
    'Trabajo realizado': { bg: '#FBE6D8', fg: '#8A3B12' },
    'Oportunidad': { bg: '#E7E4F7', fg: '#423A8A' }
  };
  var TINTS = [
    { bg: '#DDF0EE', fg: '#0B5653' }, { bg: '#FBE6D8', fg: '#8A3B12' }, { bg: '#E7E4F7', fg: '#423A8A' },
    { bg: '#E4EDF7', fg: '#244A75' }, { bg: '#F6EDCB', fg: '#6B5310' }
  ];
  var MAX_PHOTO_BYTES = 5 * 1024 * 1024;

  function $(id) { return document.getElementById(id); }

  if (!window.supabase || !window.supabase.createClient) {
    $('countLabel').textContent = 'No se pudo conectar con el servidor. Revisa tu internet y recarga la página.';
    return;
  }
  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);

  var state = {
    user: null,
    profiles: [],
    byId: {},
    prof: 'Todas',
    city: 'Todas',
    sel: null,
    selData: null,
    conns: [],
    msgs: [],
    collabReqs: [],
    active: null,
    typingFrom: {},
    posts: [],
    postType: 'Oportunidad',
    postFiles: [],
    channel: null,
    typingInbox: null,
    typingOut: null,
    typingOutId: null,
    lastTypingSent: 0,
    goProfile: false
  };

  // ---------- Utilidades ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function initials(n) {
    var parts = String(n || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function tintFor(id) {
    var h = 0; var s = String(id || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return TINTS[h % TINTS.length];
  }
  function me() { return state.user ? state.user.id : null; }
  function myProfile() { return me() ? state.byId[me()] : null; }
  function roleLabel(p) { return p.profession + (p.title ? ' · ' + p.title : ''); }
  function firstName(p) { return String(p.name || '').split(' ')[0]; }
  function photoUrl(path) {
    return C.SUPABASE_URL + '/storage/v1/object/public/' + C.PHOTO_BUCKET + '/' +
      String(path).split('/').map(encodeURIComponent).join('/');
  }
  function avatar(p, size) {
    if (p && p.avatar_path) {
      return '<img class="avatar av-' + size + '" src="' + esc(photoUrl(p.avatar_path)) + '" alt="" loading="lazy">';
    }
    var t = p && p.id ? tintFor(p.id) : { bg: '#16232B', fg: '#FFFFFF' };
    return '<span class="avatar av-' + size + '" aria-hidden="true" style="background:' + t.bg + ';color:' + t.fg + '">' + esc(initials(p ? p.name : '?')) + '</span>';
  }
  // Para visitantes: foto de perfil oculta (borrosa o silueta)
  var SILHOUETTE = '<svg viewBox="0 0 24 24" width="60%" height="60%" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c.8-4.4 4.2-7 8.5-7s7.7 2.6 8.5 7z"/></svg>';
  function hiddenAvatar(p, size) {
    if (p && p.avatar_path) {
      return '<span class="avatar av-' + size + ' hidden-av"><img src="' + esc(photoUrl(p.avatar_path)) + '" alt="" loading="lazy"></span>';
    }
    return '<span class="avatar av-' + size + ' hidden-av silhouette" aria-hidden="true">' + SILHOUETTE + '</span>';
  }
  // Lo que ve cada quien: con sesión, todo; sin sesión, primer nombre y foto oculta
  function showName(p) { return state.user ? p.name : firstName(p); }
  function showAvatar(p, size) { return state.user ? avatar(p, size) : hiddenAvatar(p, size); }
  function fmtTime(iso) {
    var d = new Date(iso); var now = new Date();
    if (d.toDateString() === now.toDateString()) {
      var h = d.getHours(); var m = d.getMinutes();
      return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' a. m.' : ' p. m.');
    }
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }
  function relTime(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'Ahora';
    if (s < 3600) return 'Hace ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'Hace ' + Math.floor(s / 3600) + ' h';
    if (s < 172800) return 'Ayer';
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }
  function options(list, withAll) {
    return (withAll ? ['Todas'] : []).concat(list).map(function (o) {
      return '<option value="' + esc(o) + '">' + esc(o) + '</option>';
    }).join('');
  }
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4000);
  }
  function formMsg(id, text, ok) {
    var el = $(id); el.hidden = !text; el.textContent = text || '';
    el.className = 'form-msg' + (ok ? ' ok' : '');
  }
  function busy(form, on) {
    var b = form.querySelector('button[type=submit]');
    if (!b) return;
    if (on) { b.dataset.label = b.textContent; b.textContent = 'Un momento…'; b.disabled = true; }
    else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; }
  }
  function errText(e) {
    var m = (e && e.message) || String(e || '');
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'Primero confirma tu correo con el enlace que te enviamos.';
    if (/already registered/i.test(m)) return 'Ya existe una cuenta con ese correo. Usa "Entrar".';
    if (/Password should be/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.';
    if (/rate limit/i.test(m)) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
    if (/duplicate key/i.test(m)) return 'Ya existe una solicitud con esta persona.';
    if (/row-level security/i.test(m)) return 'No tienes permiso para hacer eso.';
    return 'Algo salió mal: ' + m;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  var HOUSE = '<svg width="56" height="56" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><path d="M8 30 L32 10 L56 30"/><path d="M14 26 L14 54 L50 54 L50 26"/><rect x="27" y="38" width="10" height="16"/></svg>';
  var PIN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';

  // ---------- Fotos: reducir tamaño antes de subir ----------
  function shrinkImage(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve(file);
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        if (scale === 1 && file.size <= 1.5 * 1024 * 1024) { URL.revokeObjectURL(url); return resolve(file); }
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  async function uploadPhoto(file, folder) {
    var blob = await shrinkImage(file);
    if (blob.size > MAX_PHOTO_BYTES) throw new Error('La foto pesa más de 5 MB.');
    var type = blob.type || file.type;
    var ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    var path = me() + '/' + folder + '/' + uuid() + '.' + ext;
    var res = await sb.storage.from(C.PHOTO_BUCKET).upload(path, blob, { contentType: type, upsert: false });
    if (res.error) throw res.error;
    return path;
  }

  // ---------- Carga de datos ----------
  async function loadProfiles() {
    var res = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000);
    if (res.error) { $('countLabel').textContent = 'No se pudieron cargar los miembros.'; console.error(res.error); return; }
    state.profiles = res.data || [];
    state.byId = {};
    state.profiles.forEach(function (p) { state.byId[p.id] = p; });
    var cities = Array.from(new Set(state.profiles.map(function (p) { return p.city; }))).sort();
    var cur = state.city;
    $('filterCity').innerHTML = options(cities, true);
    $('filterCity').value = cities.indexOf(cur) >= 0 ? cur : 'Todas';
    state.city = $('filterCity').value;
    $('memberNames').innerHTML = state.profiles.map(function (p) { return '<option value="' + esc(p.name) + '"></option>'; }).join('');
  }

  async function loadPosts() {
    var res = await sb.from('posts').select('*').order('created_at', { ascending: false }).limit(50);
    if (res.error) { console.error(res.error); return; }
    state.posts = res.data || [];
  }

  async function loadConnections() {
    if (!me()) { state.conns = []; return; }
    var res = await sb.from('connections').select('*').or('requester_id.eq.' + me() + ',addressee_id.eq.' + me());
    if (!res.error) state.conns = res.data || [];
  }

  async function loadMessages() {
    if (!me()) { state.msgs = []; return; }
    var res = await sb.from('messages').select('*')
      .or('sender_id.eq.' + me() + ',recipient_id.eq.' + me())
      .order('created_at', { ascending: true }).limit(2000);
    if (!res.error) state.msgs = res.data || [];
  }

  async function loadCollabRequests() {
    if (!me()) { state.collabReqs = []; return; }
    var res = await sb.from('collaborations').select('*').eq('collaborator_id', me()).eq('confirmed', false);
    if (!res.error) state.collabReqs = res.data || [];
  }

  async function loadSelected() {
    var id = state.sel;
    if (!id) { state.selData = null; return; }
    var r = await Promise.all([
      sb.from('portfolio_items').select('*').eq('profile_id', id).order('created_at', { ascending: false }),
      sb.from('collaborations').select('*').eq('profile_id', id).order('created_at', { ascending: true }),
      sb.from('connections').select('*').eq('status', 'accepted').or('requester_id.eq.' + id + ',addressee_id.eq.' + id)
    ]);
    if (state.sel !== id) return;
    state.selData = {
      portfolio: r[0].data || [],
      collabs: r[1].data || [],
      contacts: (r[2].data || []).map(function (c) { return c.requester_id === id ? c.addressee_id : c.requester_id; })
    };
  }

  // ---------- Conexiones ----------
  function connWith(id) {
    return state.conns.filter(function (c) {
      return (c.requester_id === me() && c.addressee_id === id) || (c.requester_id === id && c.addressee_id === me());
    })[0];
  }
  function statusWith(id) {
    var c = connWith(id);
    if (!c) return 'none';
    if (c.status === 'accepted') return 'connected';
    return c.requester_id === me() ? 'pending-out' : 'pending-in';
  }
  function partnerIds() {
    return state.conns.filter(function (c) { return c.status === 'accepted'; })
      .map(function (c) { return c.requester_id === me() ? c.addressee_id : c.requester_id; })
      .filter(function (id) { return state.byId[id]; });
  }

  // ---------- Render: encabezado ----------
  function renderHeader() {
    var p = myProfile();
    $('authOut').hidden = !!state.user;
    $('authIn').hidden = !state.user;
    if (p) { $('meAvatar').innerHTML = avatar(p, 28); $('meName').textContent = firstName(p); }
    var unread = state.msgs.filter(function (m) { return m.recipient_id === me() && !m.read_at; }).length;
    var reqs = state.conns.filter(function (c) { return c.status === 'pending' && c.addressee_id === me(); }).length + state.collabReqs.length;
    var total = unread + reqs;
    $('unreadBadge').hidden = total === 0;
    $('unreadBadge').textContent = total;
  }

  // ---------- Render: directorio ----------
  function renderMembers() {
    var list = state.profiles.filter(function (m) {
      return (state.prof === 'Todas' || m.profession === state.prof) && (state.city === 'Todas' || m.city === state.city);
    });
    $('countLabel').textContent = list.length + (list.length === 1 ? ' profesional' : ' profesionales') + ' en Florida';
    var empty = $('emptyMembers');
    empty.hidden = list.length > 0;
    empty.textContent = state.profiles.length === 0
      ? 'Todavía no hay miembros. ¡Sé el primero en crear tu perfil!'
      : 'Aún no hay miembros con esa combinación. Prueba otra ciudad o profesión.';
    $('memberGrid').innerHTML = list.map(function (m) {
      return '<article class="card member-card">' +
        '<div class="member-top">' + showAvatar(m, 56) +
        '<div><h3>' + esc(showName(m)) + '</h3><p class="role">' + esc(roleLabel(m)) + '</p></div></div>' +
        '<p class="city">' + PIN + esc(m.city) + ', FL</p>' +
        '<p class="short">' + esc(m.short || 'Miembro de la red.') + '</p>' +
        '<a href="#/perfil" class="btn btn-soft" data-action="open-profile" data-id="' + esc(m.id) + '">Ver perfil</a>' +
        '</article>';
    }).join('');
  }

  // ---------- Render: perfil ----------
  function renderProfile() {
    var section = $('perfil');
    var p = state.sel ? state.byId[state.sel] : null;
    section.hidden = !p;
    if (!p) return;
    var d = state.selData || { portfolio: [], collabs: [], contacts: [] };
    var isMe = p.id === me();
    var st = isMe ? 'me' : (state.user ? statusWith(p.id) : 'guest');
    var first = firstName(p);

    var actions;
    if (st === 'me') {
      actions = '<button type="button" class="btn btn-primary" data-action="edit-profile">Editar perfil</button>' +
        '<button type="button" class="btn btn-outline" data-action="add-photo">Agregar foto</button>';
    } else if (st === 'guest') {
      actions = '<button type="button" class="btn btn-primary" data-action="open-login">Conectar</button>';
    } else if (st === 'none') {
      actions = '<button type="button" class="btn btn-primary" data-action="connect" data-id="' + esc(p.id) + '">Conectar</button>' +
        '<button type="button" class="btn btn-disabled" disabled title="Conéctate para enviar mensajes">Enviar mensaje</button>';
    } else if (st === 'pending-out') {
      actions = '<button type="button" class="btn btn-pending" disabled>Solicitud enviada</button>';
    } else if (st === 'pending-in') {
      var c = connWith(p.id);
      actions = '<button type="button" class="btn btn-primary" data-action="accept-conn" data-id="' + esc(c.id) + '">Aceptar solicitud</button>' +
        '<button type="button" class="btn btn-ghost" data-action="reject-conn" data-id="' + esc(c.id) + '">Ignorar</button>';
    } else {
      actions = '<span class="pill-ok">' + CHECK + 'Conectados</span>' +
        '<a href="#/mensajes" class="btn btn-primary" data-action="open-chat" data-id="' + esc(p.id) + '">Enviar mensaje</a>';
    }

    var hint = '';
    if (st === 'none') hint = 'Conéctate con ' + first + ' para poder enviarle mensajes.';
    if (st === 'pending-out') hint = first + ' todavía no acepta tu solicitud.';
    if (st === 'pending-in') hint = first + ' quiere conectar contigo.';
    if (st === 'guest') hint = 'Crea tu perfil o entra a tu cuenta para ver quién es ' + first + ' y conectar.';

    var portfolio = d.portfolio.length ? d.portfolio.map(function (it) {
      return '<figure><img class="photo-img" src="' + esc(photoUrl(it.image_path)) + '" alt="' + esc(it.title) + '" loading="lazy">' +
        '<figcaption>' + esc(it.title) + (it.caption ? '<span>' + esc(it.caption) + '</span>' : '') +
        (isMe ? '<button type="button" class="link-btn danger" data-action="del-photo" data-id="' + esc(it.id) + '">Quitar</button>' : '') +
        '</figcaption></figure>';
    }).join('') : '<div class="empty-tile">' + HOUSE + '<span>' + (isMe ? 'Sube fotos de tus trabajos con "Agregar foto".' : 'Todavía no hay fotos.') + '</span></div>';

    var contacts = d.contacts.map(function (id) { return state.byId[id]; }).filter(Boolean);
    var contactsHtml = contacts.map(function (c) {
      return '<a href="#/perfil" class="contact" data-action="open-profile" data-id="' + esc(c.id) + '">' + showAvatar(c, 36) +
        '<span class="txt"><strong>' + esc(c.id === me() ? 'Tú' : showName(c)) + '</strong><small>' + esc(c.profession) + '</small></span></a>';
    }).join('') || '<p class="small">Todavía sin contactos.</p>';

    var collabsHtml = d.collabs.map(function (c) {
      var member = c.collaborator_id ? state.byId[c.collaborator_id] : null;
      var name = member ? showName(member) : (state.user ? c.collaborator_name : firstName({ name: c.collaborator_name }));
      var tag = c.confirmed ? '' : (c.collaborator_id ? '<span class="tag-pending">Pendiente</span>' : '<span class="tag-muted">Sin cuenta</span>');
      var canDel = isMe || (c.collaborator_id && c.collaborator_id === me());
      return '<span class="collab">' + (member ? showAvatar(member, 28) : avatar({ name: name }, 28)) +
        '<span>' + (member ? '<a href="#/perfil" class="collab-name" data-action="open-profile" data-id="' + esc(member.id) + '">' + esc(name) + '</a>' : '<strong>' + esc(name) + '</strong>') +
        (member ? ' <span class="role-txt">· ' + esc(member.profession) + '</span>' : '') + '</span>' + tag +
        (canDel ? '<button type="button" class="x-btn" aria-label="Quitar colaboración con ' + esc(name) + '" data-action="del-collab" data-id="' + esc(c.id) + '">×</button>' : '') +
        '</span>';
    }).join('') || '<p class="small">Aún no hay colaboraciones.</p>';

    $('profile').innerHTML =
      '<div class="profile-cover"></div>' +
      '<div class="profile-body">' +
        '<div class="profile-head">' +
          '<div class="profile-id">' + showAvatar(p, 112).replace('class="avatar av-112', 'class="avatar profile-avatar') +
            '<div><h2>' + esc(showName(p)) + '</h2><p><strong class="teal">' + esc(roleLabel(p)) + '</strong> · ' + esc(p.city) + ', FL</p></div>' +
          '</div>' +
          '<div class="profile-actions">' + actions + '</div>' +
        '</div>' +
        (p.bio || p.short ? '<p class="bio">' + esc(p.bio || p.short) + '</p>' : (isMe ? '<p class="bio muted">Cuéntale a la red quién eres: toca "Editar perfil".</p>' : '')) +
        (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') +
        '<div><div class="block-head"><h3>Portafolio</h3></div><div class="portfolio">' + portfolio + '</div></div>' +
        '<div><div class="block-head"><h3>Contactos <span>· ' + contacts.length + (contacts.length === 1 ? ' contacto' : ' contactos') + '</span></h3>' +
          '<span>Personas conectadas con ' + esc(isMe ? 'tu perfil' : first) + '</span></div>' +
          '<div class="contacts">' + contactsHtml + '</div></div>' +
        '<div class="collab-box">' +
          '<div class="block-head"><h3>Colaboraciones</h3><span>Personas con quienes ' + esc(isMe ? 'has' : first + ' ha') + ' trabajado</span></div>' +
          '<div class="collabs">' + collabsHtml + '</div>' +
          (isMe ? '<form class="collab-form" id="collabForm">' +
            '<label class="field">Agregar colaborador<input type="text" id="collabInput" list="memberNames" maxlength="80" placeholder="Nombre de la persona" autocomplete="off"></label>' +
            '<button type="submit" class="btn btn-dark">+ Agregar</button></form>' +
            '<p class="small" style="margin-top:10px">Si la persona es miembro, la colaboración queda pendiente hasta que la confirme.</p>' : '') +
        '</div>' +
      '</div>';
  }

  async function openProfile(id) {
    var changed = state.sel !== id;
    state.sel = id;
    if (changed) state.selData = null;
    renderProfile();
    await loadSelected();
    renderProfile();
  }

  // ---------- Páginas (#/perfil, #/miembros, #/mensajes, #/publicaciones, #/crear) ----------
  var VIEWS = ['inicio', 'perfil', 'miembros', 'mensajes', 'publicaciones', 'crear'];
  function parseRoute() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var view = parts[0] || 'inicio';
    return { view: VIEWS.indexOf(view) >= 0 ? view : 'inicio', id: parts[1] || null };
  }
  function go(hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  }
  function renderNav(view) {
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var on = a.getAttribute('data-nav') === view && (view !== 'perfil' || state.sel === me());
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  async function route() {
    var r = parseRoute();
    if (r.view === 'perfil') {
      var id = r.id || me();
      if (!id) { location.replace('#/crear'); return; }
      document.body.dataset.view = 'perfil';
      window.scrollTo(0, 0);
      var p = openProfile(id);
      renderNav('perfil');
      await p;
      renderNav('perfil');
      return;
    }
    if (r.view === 'crear' && state.user) { location.replace('#/perfil'); return; }
    if (r.view === 'mensajes' && !state.user) { location.replace('#/'); return; }
    document.body.dataset.view = r.view;
    renderNav(r.view);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---------- Render: solicitudes ----------
  function renderRequests() {
    var box = $('requests');
    if (!state.user) { box.hidden = true; return; }
    var inc = state.conns.filter(function (c) { return c.status === 'pending' && c.addressee_id === me() && state.byId[c.requester_id]; });
    var col = state.collabReqs.filter(function (c) { return state.byId[c.profile_id]; });
    box.hidden = inc.length + col.length === 0;
    box.innerHTML = '<strong class="req-title">Solicitudes</strong>' +
      inc.map(function (c) {
        var p = state.byId[c.requester_id];
        return '<div class="req">' + avatar(p, 44) +
          '<span class="req-text"><a href="#/perfil" data-action="open-profile" data-id="' + esc(p.id) + '">' + esc(p.name) + '</a> quiere conectar contigo<small>' + esc(roleLabel(p) + ' · ' + p.city) + '</small></span>' +
          '<span class="req-actions"><button type="button" class="btn btn-primary btn-sm" data-action="accept-conn" data-id="' + esc(c.id) + '">Aceptar</button>' +
          '<button type="button" class="btn btn-ghost" data-action="reject-conn" data-id="' + esc(c.id) + '">Ignorar</button></span></div>';
      }).join('') +
      col.map(function (c) {
        var p = state.byId[c.profile_id];
        return '<div class="req">' + avatar(p, 44) +
          '<span class="req-text"><a href="#/perfil" data-action="open-profile" data-id="' + esc(p.id) + '">' + esc(p.name) + '</a> dice que trabajó contigo<small>Al confirmar, aparece en su perfil como colaboración.</small></span>' +
          '<span class="req-actions"><button type="button" class="btn btn-primary btn-sm" data-action="confirm-collab" data-id="' + esc(c.id) + '">Confirmar</button>' +
          '<button type="button" class="btn btn-ghost" data-action="del-collab" data-id="' + esc(c.id) + '">No</button></span></div>';
      }).join('');
  }

  // ---------- Render: mensajes ----------
  function threadWith(id) {
    return state.msgs.filter(function (m) {
      return (m.sender_id === me() && m.recipient_id === id) || (m.sender_id === id && m.recipient_id === me());
    });
  }

  function renderMessenger() {
    var logged = !!state.user;
    $('msgLoggedOut').hidden = logged;
    $('messenger').hidden = !logged;
    if (!logged) return;

    var ids = partnerIds().map(function (id) {
      var t = threadWith(id); var last = t[t.length - 1];
      return { id: id, last: last, at: last ? last.created_at : '' };
    }).sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });

    $('chatList').innerHTML = ids.length ? ids.map(function (x) {
      var p = state.byId[x.id];
      var unread = state.msgs.filter(function (m) { return m.sender_id === x.id && m.recipient_id === me() && !m.read_at; }).length;
      var preview = state.typingFrom[x.id] ? 'Escribiendo…' : x.last ? (x.last.sender_id === me() ? 'Tú: ' : '') + x.last.body : 'Nuevo contacto · salúdalo';
      return '<button type="button" class="chat-row' + (x.id === state.active ? ' active' : '') + '" data-action="open-chat" data-id="' + esc(x.id) + '">' +
        avatar(p, 44) +
        '<span class="chat-row-body">' +
          '<span class="chat-row-line"><strong>' + esc(p.name) + '</strong><span class="time">' + esc(x.last ? fmtTime(x.last.created_at) : '') + '</span></span>' +
          '<span class="chat-row-line"><span class="preview">' + esc(preview) + '</span>' +
          (unread ? '<span class="badge">' + unread + '</span>' : '') + '</span>' +
        '</span></button>';
    }).join('') : '<p class="chat-none">Cuando conectes con alguien, su chat aparece aquí.</p>';

    var act = state.active && statusWith(state.active) === 'connected' && state.byId[state.active] ? state.active : null;
    $('chatHeader').hidden = !act;
    $('chatMessages').hidden = !act;
    $('chatForm').hidden = !act;
    $('chatEmpty').hidden = !!act;
    if (!act) return;

    var p = state.byId[act];
    $('chatHeader').innerHTML = avatar(p, 44) +
      '<span class="txt"><strong>' + esc(p.name) + '</strong><small>' + esc(roleLabel(p) + ' · ' + p.city) + '</small></span>';

    var t = threadWith(act);
    var last = t[t.length - 1];
    var html = t.length ? t.map(function (m) {
      return '<div class="msg' + (m.sender_id === me() ? ' me' : '') + '"><div class="bubble">' + esc(m.body) +
        '<time>' + esc(fmtTime(m.created_at)) + '</time></div></div>';
    }).join('') : '<p class="chat-first">Ya están conectados. Escribe el primer mensaje.</p>';
    var typing = !!state.typingFrom[act];
    if (last && last.sender_id === me() && !typing) {
      html += last.read_at
        ? '<div class="status">' + avatar(p, 16) + 'Visto</div>'
        : '<div class="status">Enviado</div>';
    }
    if (typing) html += '<div class="typing">' + esc(firstName(p)) + ' está escribiendo…</div>';
    var box = $('chatMessages');
    var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.innerHTML = html;
    if (nearBottom || box.dataset.chat !== act) box.scrollTop = box.scrollHeight;
    box.dataset.chat = act;
  }

  async function markRead(id) {
    var unread = state.msgs.filter(function (m) { return m.sender_id === id && m.recipient_id === me() && !m.read_at; });
    if (!unread.length) return;
    var now = new Date().toISOString();
    unread.forEach(function (m) { m.read_at = now; });
    renderMessenger(); renderHeader();
    var res = await sb.from('messages').update({ read_at: now })
      .eq('sender_id', id).eq('recipient_id', me()).is('read_at', null);
    if (res.error) console.error(res.error);
  }

  function openChat(id) {
    state.active = id;
    renderMessenger();
    markRead(id);
    // Canal para avisar "escribiendo…" a esta persona
    if (state.typingOutId !== id) {
      if (state.typingOut) sb.removeChannel(state.typingOut);
      state.typingOutId = id;
      state.typingOut = sb.channel('typing-' + id);
      state.typingOut.subscribe();
    }
  }

  function sendTyping() {
    if (!state.typingOut || !me()) return;
    var now = Date.now();
    if (now - state.lastTypingSent < 2000) return;
    state.lastTypingSent = now;
    state.typingOut.send({ type: 'broadcast', event: 'typing', payload: { from: me() } });
  }

  // ---------- Render: publicaciones ----------
  function renderTypes() {
    $('typeChips').innerHTML = TYPES.map(function (t) {
      return '<button type="button" class="type-chip" data-action="pick-type" data-type="' + esc(t) + '" aria-pressed="' + (t === state.postType) + '">' + esc(t) + '</button>';
    }).join('');
  }

  function renderPostPreview() {
    $('postPhotosPreview').innerHTML = state.postFiles.map(function (f, i) {
      return '<span class="thumb"><img src="' + esc(f.url) + '" alt=""><button type="button" class="x-btn" aria-label="Quitar foto" data-action="drop-post-photo" data-index="' + i + '">×</button></span>';
    }).join('');
  }

  function renderPosts() {
    if (!state.posts.length) {
      $('feed').innerHTML = '<div class="empty">Todavía no hay publicaciones. Comparte tu primer proyecto u oportunidad.</div>';
      return;
    }
    $('feed').innerHTML = state.posts.map(function (post) {
      var a = state.byId[post.author_id] || { id: post.author_id, name: 'Miembro', profession: '', city: '' };
      var guest = !state.user;
      var tc = TYPE_COLORS[post.type] || TYPE_COLORS['Proyecto'];
      var meta = [roleLabel(a), a.city, relTime(post.created_at)].filter(Boolean).join(' · ');
      var photos = post.photo_paths && post.photo_paths.length ? '<div class="post-photos">' + post.photo_paths.map(function (ph) {
        return '<img class="post-photo" src="' + esc(photoUrl(ph)) + '" alt="Foto de la publicación" loading="lazy">';
      }).join('') + '</div>' : '';
      var isMine = post.author_id === me();
      var connected = !isMine && state.user && statusWith(post.author_id) === 'connected';
      return '<article class="card post">' +
        '<div class="post-head"><div class="post-author">' + showAvatar(a, 46) +
          '<div><p class="name">' + esc(showName(a)) + '</p><p class="meta">' + esc(meta) + '</p></div></div>' +
          '<span class="type-badge" style="background:' + tc.bg + ';color:' + tc.fg + '">' + esc(post.type) + '</span></div>' +
        '<p class="post-text">' + esc(post.body) + '</p>' + photos +
        '<div class="post-actions">' +
          (guest ? '<a href="#/crear" class="btn btn-soft btn-sm">Crea tu perfil para ver quién es</a>'
            : isMine ? '<button type="button" class="btn btn-ghost" data-action="del-post" data-id="' + esc(post.id) + '">Borrar</button>'
            : '<a href="#/perfil" class="btn btn-soft btn-sm" data-action="open-profile" data-id="' + esc(a.id) + '">Ver perfil</a>' +
              (connected ? '<a href="#/mensajes" class="btn btn-ghost" data-action="open-chat" data-id="' + esc(a.id) + '">Enviar mensaje</a>' : '')) +
        '</div></article>';
    }).join('');
  }

  // ---------- Render: crear perfil ----------
  function renderCreate() {
    var p = myProfile();
    $('signupForm').hidden = !!state.user;
    $('signedInBox').hidden = !state.user;
    var view = p || {
      id: null,
      name: $('cName').value.trim() || 'Tu nombre',
      profession: $('cProf').value,
      title: $('cTitle').value.trim(),
      city: $('cCity').value.trim() || 'Tu ciudad',
      short: $('cDesc').value.trim() || 'Cuéntale a la red qué haces y dónde trabajas.'
    };
    $('preview').innerHTML =
      '<div class="member-top">' + avatar(p ? view : { name: view.name }, 56) +
      '<div><h3>' + esc(view.name) + '</h3><p class="role">' + esc(roleLabel(view)) + '</p></div></div>' +
      '<p class="city">' + PIN + esc(view.city) + ', FL</p>' +
      '<p class="short">' + esc(view.short || 'Miembro de la red.') + '</p>';
  }

  function renderAll() {
    document.body.classList.toggle('logged-in', !!state.user);
    renderHeader();
    renderMembers();
    renderProfile();
    renderRequests();
    renderMessenger();
    renderPosts();
    renderCreate();
  }

  // ---------- Tiempo real ----------
  function subscribe() {
    unsubscribe();
    state.channel = sb.channel('fpp-' + me())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, function (payload) {
        var row = payload.new;
        if (!row || !row.id) return;
        if (row.sender_id !== me() && row.recipient_id !== me()) return;
        var i = state.msgs.findIndex(function (m) { return m.id === row.id; });
        if (i >= 0) state.msgs[i] = row; else state.msgs.push(row);
        if (row.sender_id !== me()) delete state.typingFrom[row.sender_id];
        if (payload.eventType === 'INSERT' && row.sender_id === state.active && row.recipient_id === me() && document.visibilityState === 'visible') {
          markRead(row.sender_id);
        }
        renderMessenger(); renderHeader();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, async function () {
        await loadConnections();
        renderHeader(); renderRequests(); renderMessenger(); renderPosts();
        if (state.sel) { await loadSelected(); renderProfile(); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collaborations' }, async function () {
        await loadCollabRequests();
        renderHeader(); renderRequests();
        if (state.sel) { await loadSelected(); renderProfile(); }
      })
      .subscribe();

    state.typingInbox = sb.channel('typing-' + me())
      .on('broadcast', { event: 'typing' }, function (msg) {
        var from = msg.payload && msg.payload.from;
        if (!from || statusWith(from) !== 'connected') return;
        state.typingFrom[from] = Date.now();
        renderMessenger();
        setTimeout(function () {
          if (state.typingFrom[from] && Date.now() - state.typingFrom[from] >= 3400) {
            delete state.typingFrom[from];
            renderMessenger();
          }
        }, 3500);
      })
      .subscribe();
  }

  function unsubscribe() {
    [state.channel, state.typingInbox, state.typingOut].forEach(function (ch) { if (ch) sb.removeChannel(ch); });
    state.channel = state.typingInbox = state.typingOut = null;
    state.typingOutId = null;
  }

  // ---------- Sesión ----------
  var currentUserId = null;
  async function handleUser(user) {
    var id = user ? user.id : null;
    if (id === currentUserId) return;
    currentUserId = id;
    state.user = user;
    state.active = null;
    state.typingFrom = {};
    if (user) {
      await loadProfiles();
      if (!state.byId[user.id]) { // el perfil se crea al registrarse; a veces tarda un instante
        await new Promise(function (r) { setTimeout(r, 1200); });
        await loadProfiles();
      }
      await Promise.all([loadConnections(), loadMessages(), loadCollabRequests()]);
      subscribe();
    } else {
      unsubscribe();
      state.conns = []; state.msgs = []; state.collabReqs = [];
    }
    if (state.sel) await loadSelected();
    renderAll();
    var view = parseRoute().view;
    if (user && (state.goProfile || view === 'inicio' || view === 'crear')) {
      state.goProfile = false;
      // Al entrar o crear la cuenta: ir a la página de tu perfil
      go('#/perfil');
    } else if (!user && (view === 'mensajes' || (view === 'perfil' && !parseRoute().id))) {
      go('#/');
    } else {
      route();
    }
  }

  sb.auth.onAuthStateChange(function (event, session) {
    // No llamar a Supabase directamente dentro de este aviso: se programa para después.
    setTimeout(function () { handleUser(session ? session.user : null); }, 0);
  });

  // ---------- Diálogos ----------
  function openDialog(id) { var d = $(id); if (!d.open) d.showModal(); }
  function openLogin() { formMsg('loginMsg', ''); openDialog('loginDialog'); setTimeout(function () { $('lEmail').focus(); }, 50); }
  function openEdit() {
    var p = myProfile(); if (!p) return;
    $('eName').value = p.name; $('eProf').value = p.profession; $('eCity').value = p.city;
    $('eTitle').value = p.title || ''; $('eShort').value = p.short || ''; $('eBio').value = p.bio || '';
    $('eAvatar').value = ''; $('editAvatar').innerHTML = avatar(p, 56);
    formMsg('editMsg', ''); openDialog('editDialog');
  }

  // ---------- Acciones ----------
  async function connect(id) {
    if (!state.user) return openLogin();
    var st = statusWith(id);
    if (st === 'pending-in') return acceptConn(connWith(id).id);
    if (st !== 'none') return;
    var res = await sb.from('connections').insert({ requester_id: me(), addressee_id: id }).select().single();
    if (res.error) return toast(errText(res.error));
    state.conns.push(res.data);
    renderProfile(); renderPosts();
    toast('Solicitud enviada.');
  }
  async function acceptConn(connId) {
    var res = await sb.from('connections').update({ status: 'accepted' }).eq('id', connId).select().single();
    if (res.error) return toast(errText(res.error));
    var i = state.conns.findIndex(function (c) { return c.id === connId; });
    if (i >= 0) state.conns[i] = res.data;
    renderAll();
    if (state.sel) { await loadSelected(); renderProfile(); }
    toast('¡Ahora están conectados!');
  }
  async function rejectConn(connId) {
    var res = await sb.from('connections').delete().eq('id', connId);
    if (res.error) return toast(errText(res.error));
    state.conns = state.conns.filter(function (c) { return c.id !== connId; });
    renderAll();
  }

  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');

    switch (action) {
      case 'open-login': e.preventDefault(); openLogin(); break;
      case 'close-dialog': { var d = el.closest('dialog'); if (d) d.close(); break; }
      case 'logout':
        await sb.auth.signOut();
        go('#/');
        toast('Saliste de tu cuenta.');
        break;
      case 'open-my-profile':
        e.preventDefault();
        go('#/perfil');
        break;
      case 'open-profile':
        e.preventDefault();
        go('#/perfil/' + id);
        break;
      case 'edit-profile': openEdit(); break;
      case 'add-photo':
        $('photoForm').reset(); formMsg('photoMsg', ''); openDialog('photoDialog');
        break;
      case 'connect': el.disabled = true; await connect(id); break;
      case 'accept-conn': el.disabled = true; await acceptConn(id); break;
      case 'reject-conn': el.disabled = true; await rejectConn(id); break;
      case 'open-chat':
        e.preventDefault();
        openChat(id);
        if (parseRoute().view !== 'mensajes') go('#/mensajes');
        setTimeout(function () { $('chatInput').focus({ preventScroll: true }); }, 200);
        break;
      case 'pick-type': state.postType = el.getAttribute('data-type'); renderTypes(); break;
      case 'drop-post-photo': {
        var i = Number(el.getAttribute('data-index'));
        URL.revokeObjectURL(state.postFiles[i].url);
        state.postFiles.splice(i, 1); renderPostPreview();
        break;
      }
      case 'del-photo': {
        if (!confirmAction('¿Quitar esta foto de tu portafolio?')) return;
        var item = (state.selData.portfolio || []).filter(function (x) { return x.id === id; })[0];
        var res = await sb.from('portfolio_items').delete().eq('id', id);
        if (res.error) return toast(errText(res.error));
        if (item) sb.storage.from(C.PHOTO_BUCKET).remove([item.image_path]);
        await loadSelected(); renderProfile();
        break;
      }
      case 'del-collab': {
        var r2 = await sb.from('collaborations').delete().eq('id', id);
        if (r2.error) return toast(errText(r2.error));
        await loadCollabRequests();
        if (state.sel) await loadSelected();
        renderAll();
        break;
      }
      case 'confirm-collab': {
        el.disabled = true;
        var r3 = await sb.from('collaborations').update({ confirmed: true }).eq('id', id);
        if (r3.error) return toast(errText(r3.error));
        await loadCollabRequests();
        if (state.sel) await loadSelected();
        renderAll();
        toast('Colaboración confirmada.');
        break;
      }
      case 'del-post': {
        if (!confirmAction('¿Borrar esta publicación?')) return;
        var post = state.posts.filter(function (x) { return x.id === id; })[0];
        var r4 = await sb.from('posts').delete().eq('id', id);
        if (r4.error) return toast(errText(r4.error));
        if (post && post.photo_paths.length) sb.storage.from(C.PHOTO_BUCKET).remove(post.photo_paths);
        state.posts = state.posts.filter(function (x) { return x.id !== id; });
        renderPosts();
        break;
      }
    }
  });

  function confirmAction(text) { return window.confirm(text); }

  // Formularios que se dibujan dentro del perfil
  document.addEventListener('submit', async function (e) {
    if (e.target.id !== 'collabForm') return;
    e.preventDefault();
    var input = $('collabInput');
    var name = input.value.trim();
    if (!name) return;
    var match = state.profiles.filter(function (p) { return p.id !== me() && p.name.toLowerCase() === name.toLowerCase(); })[0];
    var row = { profile_id: me(), collaborator_name: match ? match.name : name, collaborator_id: match ? match.id : null };
    busy(e.target, true);
    var res = await sb.from('collaborations').insert(row);
    busy(e.target, false);
    if (res.error) return toast(errText(res.error));
    await loadSelected(); renderProfile();
    toast(match ? 'Le avisamos a ' + firstName(match) + ' para que confirme.' : 'Colaboración agregada.');
  });

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    busy(e.target, true);
    var res = await sb.auth.signInWithPassword({ email: $('lEmail').value.trim(), password: $('lPass').value });
    busy(e.target, false);
    if (res.error) return formMsg('loginMsg', errText(res.error));
    state.goProfile = true;
    $('loginDialog').close();
    $('lPass').value = '';
    toast('¡Bienvenido de vuelta!');
  });

  $('signupForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    formMsg('signupMsg', '');
    busy(e.target, true);
    var email = $('cEmail').value.trim();
    var res = await sb.auth.signUp({
      email: email,
      password: $('cPass').value,
      options: {
        emailRedirectTo: location.origin + location.pathname,
        data: {
          name: $('cName').value.trim(),
          profession: $('cProf').value,
          city: $('cCity').value.trim(),
          title: $('cTitle').value.trim(),
          short: $('cDesc').value.trim()
        }
      }
    });
    busy(e.target, false);
    if (res.error) return formMsg('signupMsg', errText(res.error));
    $('cPass').value = '';
    if (res.data && res.data.session) {
      state.goProfile = true;
      toast('¡Listo! Ya estás en la red. Completa tu perfil con una foto.');
    } else {
      formMsg('signupMsg', 'Te enviamos un correo a ' + email + '. Abre el enlace para activar tu cuenta y luego entra.', true);
    }
  });

  $('editForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    busy(e.target, true);
    try {
      var upd = {
        name: $('eName').value.trim(), profession: $('eProf').value, city: $('eCity').value.trim(),
        title: $('eTitle').value.trim() || null, short: $('eShort').value.trim() || null, bio: $('eBio').value.trim() || null
      };
      var file = $('eAvatar').files[0];
      var oldAvatar = myProfile() && myProfile().avatar_path;
      if (file) upd.avatar_path = await uploadPhoto(file, 'avatar');
      var res = await sb.from('profiles').update(upd).eq('id', me());
      if (res.error) throw res.error;
      if (file && oldAvatar) sb.storage.from(C.PHOTO_BUCKET).remove([oldAvatar]);
      await loadProfiles();
      $('editDialog').close();
      renderAll();
      toast('Perfil guardado.');
    } catch (err) {
      formMsg('editMsg', errText(err));
    } finally {
      busy(e.target, false);
    }
  });

  $('eAvatar').addEventListener('change', function () {
    var f = this.files[0];
    if (f) $('editAvatar').innerHTML = '<img class="avatar av-56" src="' + esc(URL.createObjectURL(f)) + '" alt="">';
  });

  $('photoForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var file = $('pFile').files[0];
    if (!file) return;
    busy(e.target, true);
    try {
      var path = await uploadPhoto(file, 'portfolio');
      var res = await sb.from('portfolio_items').insert({
        profile_id: me(), title: $('pTitle').value.trim(), caption: $('pCaption').value.trim() || null, image_path: path
      });
      if (res.error) throw res.error;
      $('photoDialog').close();
      await loadSelected(); renderProfile();
      toast('Foto agregada a tu portafolio.');
    } catch (err) {
      formMsg('photoMsg', errText(err));
    } finally {
      busy(e.target, false);
    }
  });

  $('postPhotos').addEventListener('change', function () {
    var files = Array.from(this.files || []);
    files.forEach(function (f) {
      if (state.postFiles.length < 4) state.postFiles.push({ file: f, url: URL.createObjectURL(f) });
    });
    if (files.length && state.postFiles.length >= 4) toast('Máximo 4 fotos por publicación.');
    this.value = '';
    renderPostPreview();
  });

  $('postForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!state.user) return openLogin();
    var text = $('postText').value.trim();
    if (!text) return toast('Escribe algo para publicar.');
    busy(e.target, true);
    try {
      var paths = [];
      for (var i = 0; i < state.postFiles.length; i++) paths.push(await uploadPhoto(state.postFiles[i].file, 'posts'));
      var res = await sb.from('posts').insert({ author_id: me(), type: state.postType, body: text, photo_paths: paths }).select().single();
      if (res.error) throw res.error;
      state.posts.unshift(res.data);
      $('postText').value = '';
      state.postFiles.forEach(function (f) { URL.revokeObjectURL(f.url); });
      state.postFiles = [];
      renderPostPreview(); renderPosts();
      toast('Publicado.');
    } catch (err) {
      toast(errText(err));
    } finally {
      busy(e.target, false);
    }
  });

  $('chatForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = state.active;
    var input = $('chatInput');
    var body = input.value.trim();
    if (!id || !body) return;
    input.value = '';
    var res = await sb.from('messages').insert({ sender_id: me(), recipient_id: id, body: body }).select().single();
    if (res.error) { input.value = body; return toast(errText(res.error)); }
    if (!state.msgs.some(function (m) { return m.id === res.data.id; })) state.msgs.push(res.data);
    renderMessenger();
  });

  $('chatInput').addEventListener('input', sendTyping);

  ['cName', 'cProf', 'cCity', 'cTitle', 'cDesc'].forEach(function (id) {
    $(id).addEventListener('input', renderCreate);
    $(id).addEventListener('change', renderCreate);
  });

  $('filterProf').addEventListener('change', function (e) { state.prof = e.target.value; renderMembers(); });
  $('filterCity').addEventListener('change', function (e) { state.city = e.target.value; renderMembers(); });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state.active) markRead(state.active);
  });

  // ---------- Inicio ----------
  $('filterProf').innerHTML = options(PROFS, true);
  $('filterCity').innerHTML = options([], true);
  $('cProf').innerHTML = options(PROFS, false);
  $('eProf').innerHTML = options(PROFS, false);
  renderTypes();
  renderCreate();

  (async function start() {
    await Promise.all([loadProfiles(), loadPosts()]);
    var s = await sb.auth.getSession();
    var sessionUser = s.data && s.data.session ? s.data.session.user : null;
    await handleUser(sessionUser);
    renderAll();
    if (!sessionUser) route(); // visitantes: abrir la página del enlace (#/miembros, #/perfil/…)
  })();
})();
