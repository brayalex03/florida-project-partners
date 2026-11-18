(function () {
  'use strict';

  var C = window.FPP_CONFIG;
  var PROFS = ['General Contractor', 'Contratista', 'Prestamista', 'Realtor', 'Arquitecto', 'Inversionista', 'Proveedor'];
  var TYPES = ['Proyecto', 'Trabajo realizado', 'Oportunidad'];
  var WORKER = 'Trabajador de construcción';
  var EMPLOYERS = ['General Contractor', 'Contratista', 'Inversionista'];
  var TRADES = ['Drywall', 'Pintura', 'Carpintería', 'Concreto', 'Techos', 'Plomería', 'Electricidad',
    'Pisos y azulejos', 'Demolición', 'Landscaping', 'Ayudante general', 'Otro'];
  var AVAIL_DAYS = 14; // "Disponible" se apaga solo si no se confirma en 14 días
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
    goProfile: false,
    jobs: [],
    apps: [],
    openApps: {},
    jobTab: 'ofertas',
    jobTrade: 'Todos',
    jobCity: 'Todas',
    wkTrade: 'Todos',
    wkCity: 'Todas',
    wkAvail: true,
    chatPrefs: {},
    contacts: {},
    ctSearch: '',
    ctProf: 'Todas',
    ctCity: 'Todas',
    editNote: null
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
  function roleLabel(p) {
    if (p.profession === WORKER) return 'Trabajador · ' + (p.trade || 'Construcción');
    return p.profession + (p.title ? ' · ' + p.title : '');
  }
  var ICON_ADD, ICON_IN;
  function isWorker(p) { return !!p && p.profession === WORKER; }
  function amWorker() { return isWorker(myProfile()); }
  function amEmployer() { var p = myProfile(); return !!p && EMPLOYERS.indexOf(p.profession) >= 0; }
  function isAvailable(p) {
    return !!p && !!p.available && !!p.available_since &&
      (Date.now() - new Date(p.available_since).getTime()) < AVAIL_DAYS * 86400000;
  }
  function availPill(p) {
    return isAvailable(p) ? '<span class="avail on">Disponible</span>' : '<span class="avail">No disponible</span>';
  }
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
  // Ejemplo de "Sobre mí" según la profesión
  var ABOUT_EXAMPLES = {
    'General Contractor': 'Ej.: GC con licencia y 15 años en remodelaciones y casas nuevas en Marion County. Busco inversionistas y realtors para proyectos de fix & flip.',
    'Contratista': 'Ej.: Electricista con licencia, 10 años en instalaciones residenciales y cambio de paneles en Tampa y Ocala. Trabajo como subcontratista para GCs.',
    'Prestamista': 'Ej.: Financio fix & flip y construcción nueva en todo Florida. Aprobación rápida y desembolsos por etapas de obra.',
    'Realtor': 'Ej.: Realtor bilingüe en Orlando y Kissimmee, enfocada en inversionistas. Encuentro casas para remodelar y las vendo cuando están listas.',
    'Arquitecto': 'Ej.: Arquitecta con estudio propio en Tampa. Diseño casas y dúplex, preparo planos para permisos y acompaño la obra.',
    'Inversionista': 'Ej.: Compro 5 a 10 casas al año para remodelar en Ocala y Gainesville. Busco GCs confiables y realtors que conozcan la zona.',
    'Trabajador de construcción': 'Ej.: 8 años en drywall y pintura. Tengo carro y herramientas propias. Trabajo en Ocala y alrededores, puedo empezar de inmediato.',
    'Proveedor': 'Ej.: Distribuidor de gabinetes, cuarzo y pisos en Central Florida. Entrego en obra y doy precio especial a contratistas.'
  };
  function setAboutExample(id, profession) { $(id).placeholder = ABOUT_EXAMPLES[profession] || ''; }
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

  // Mis contactos: agenda privada (solo la ve su dueño)
  async function loadConnections() {
    state.conns = [];
    if (!me()) { state.contacts = {}; return; }
    var res = await sb.from('contacts').select('*').eq('owner_id', me());
    if (res.error) return;
    state.contacts = {};
    (res.data || []).forEach(function (c) { state.contacts[c.contact_id] = c; });
  }

  async function loadMessages() {
    if (!me()) { state.msgs = []; return; }
    var res = await sb.from('messages').select('*')
      .or('sender_id.eq.' + me() + ',recipient_id.eq.' + me())
      .order('created_at', { ascending: true }).limit(2000);
    if (!res.error) state.msgs = res.data || [];
  }

  async function loadJobs() {
    var res = await sb.from('job_offers').select('*').order('created_at', { ascending: false }).limit(200);
    if (!res.error) state.jobs = res.data || [];
  }
  async function loadApps() {
    if (!me()) { state.apps = []; return; }
    var res = await sb.from('job_applications').select('*').order('created_at', { ascending: true });
    if (!res.error) state.apps = res.data || [];
  }

  async function loadChatPrefs() {
    if (!me()) { state.chatPrefs = {}; return; }
    var res = await sb.from('chat_prefs').select('*');
    if (res.error) return;
    state.chatPrefs = {};
    (res.data || []).forEach(function (r) { state.chatPrefs[r.partner_id] = r.state; });
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
      sb.from('connections').select('*').eq('status', 'accepted').or('requester_id.eq.' + id + ',addressee_id.eq.' + id),
      sb.from('posts').select('*').eq('author_id', id).order('created_at', { ascending: false }).limit(30)
    ]);
    if (state.sel !== id) return;
    state.selData = {
      portfolio: r[0].data || [],
      collabs: r[1].data || [],
      contacts: (r[2].data || []).map(function (c) { return c.requester_id === id ? c.addressee_id : c.requester_id; }),
      posts: r[3].data || []
    };
  }

  // ---------- Conexiones ----------
  function connWith() { return null; }
  function isContact(id) { return !!state.contacts[id]; }
  // 'connected' = está en mis contactos
  function statusWith(id) { return isContact(id) ? 'connected' : 'none'; }
  // Personas con conversación o contacto (las ignoradas se ocultan)
  function partnerIds() {
    var ids = {};
    state.conns.filter(function (c) { return c.status === 'accepted'; })
      .forEach(function (c) { ids[c.requester_id === me() ? c.addressee_id : c.requester_id] = true; });
    state.msgs.forEach(function (m) { ids[m.sender_id === me() ? m.recipient_id : m.sender_id] = true; });
    if (state.active) ids[state.active] = true;
    return Object.keys(ids).filter(function (id) {
      return id !== me() && state.byId[id] && (state.chatPrefs[id] !== 'ignored' || id === state.active);
    });
  }
  function theyWrote(id) { return state.msgs.some(function (m) { return m.sender_id === id && m.recipient_id === me(); }); }
  function iWrote(id) { return state.msgs.some(function (m) { return m.sender_id === me() && m.recipient_id === id; }); }
  function appliedToEmployer(id) {
    return state.apps.some(function (a) {
      var o = state.jobs.filter(function (x) { return x.id === a.offer_id; })[0];
      return a.worker_id === me() && o && o.employer_id === id;
    });
  }
  // ¿Puedo escribirle? (las mismas reglas que la base de datos)
  function canMessage(id) {
    var p = state.byId[id];
    if (!state.user || !p || id === me()) return false;
    if (theyWrote(id)) return true;
    if (amWorker()) return false;
    return !isWorker(p) || amEmployer();
  }
  // Conversación que llegó de alguien que no es contacto y aún no respondo ni acepto
  function isMsgRequest(id) {
    return theyWrote(id) && !iWrote(id) && statusWith(id) !== 'connected' &&
      state.chatPrefs[id] !== 'accepted' && !(amWorker() && appliedToEmployer(id));
  }
  async function setChatPref(id, value) {
    state.chatPrefs[id] = value;
    var res = await sb.from('chat_prefs').upsert({ user_id: me(), partner_id: id, state: value }, { onConflict: 'user_id,partner_id' });
    if (res.error) toast(errText(res.error));
  }

  // ---------- Render: encabezado ----------
  function renderHeader() {
    var p = myProfile();
    $('authOut').hidden = !!state.user;
    $('authIn').hidden = !state.user;
    if (p) { $('meAvatar').innerHTML = avatar(p, 28); $('meName').textContent = firstName(p); }
    var unread = state.msgs.filter(function (m) { return m.recipient_id === me() && !m.read_at && state.chatPrefs[m.sender_id] !== 'ignored'; }).length;
    var reqs = state.conns.filter(function (c) { return c.status === 'pending' && c.addressee_id === me(); }).length + state.collabReqs.length;
    var total = unread + reqs;
    $('unreadBadge').hidden = total === 0;
    $('unreadBadge').textContent = total;
    state.notifTotal = total;
    // El mismo número en el botón "Mensajes" de tu perfil
    var pb = $('profileMsgBadge');
    if (pb) { pb.hidden = total === 0; pb.textContent = total; }
  }

  // ---------- Render: directorio ----------
  function renderMembers() {
    var list = state.profiles.filter(function (m) {
      return !isWorker(m) && (state.prof === 'Todas' || m.profession === state.prof) && (state.city === 'Todas' || m.city === state.city);
    });
    $('countLabel').textContent = list.length + (list.length === 1 ? ' profesional' : ' profesionales') + ' en Florida';
    var empty = $('emptyMembers');
    empty.hidden = list.length > 0;
    empty.textContent = state.profiles.filter(function (m) { return !isWorker(m); }).length === 0
      ? 'Todavía no hay miembros. ¡Sé el primero en crear tu perfil!'
      : 'Aún no hay miembros con esa combinación. Prueba otra ciudad o profesión.';
    $('memberGrid').innerHTML = list.map(function (m) {
      return '<article class="card member-card">' +
        '<div class="member-top">' + showAvatar(m, 56) +
        '<div><h3>' + esc(showName(m)) + '</h3><p class="role">' + esc(roleLabel(m)) + '</p></div></div>' +
        '<p class="city">' + PIN + esc(m.city) + ', FL</p>' +
        '<p class="short clamp">' + esc(m.bio || m.short || 'Miembro de la red.') + '</p>' +
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
    var d = state.selData || { portfolio: [], collabs: [], contacts: [], posts: [] };
    var isMe = p.id === me();
    var st = isMe ? 'me' : (state.user ? statusWith(p.id) : 'guest');
    var first = firstName(p);
    var worker = isWorker(p);
    var viewerWorker = amWorker();

    var actions;
    if (st === 'me') {
      actions = '<button type="button" class="btn btn-primary" data-action="edit-profile">Editar perfil</button>' +
        (worker ? '<button type="button" class="btn btn-outline" data-action="toggle-available">' + (isAvailable(p) ? 'Ya no estoy disponible' : 'Estoy disponible') + '</button>' : '');
    } else if (st === 'guest') {
      actions = '<button type="button" class="btn btn-primary" data-action="open-login">Conectar</button>';
    } else if (st === 'none') {
      actions = '<button type="button" class="btn btn-outline" data-action="connect" data-id="' + esc(p.id) + '">' + ICON_ADD + 'Agregar a contactos</button>' +
        (canMessage(p.id) ? msgBtn(p.id, 'btn-primary') : '');
    } else {
      actions = '<a href="#/contactos" class="pill-ok" title="Ver en Mis contactos">' + ICON_IN + 'En tus contactos</a>' +
        (canMessage(p.id) ? msgBtn(p.id, 'btn-primary') : '');
    }

    var hint = '';
    if (viewerWorker && !isMe && !canMessage(p.id)) hint = 'Postúlate a sus ofertas en la Bolsa de trabajo para que te escriba.';
    if (st === 'guest') hint = 'Crea tu perfil o entra a tu cuenta para ver quién es ' + first + ' y escribirle.';

    var portfolio = d.portfolio.length ? d.portfolio.map(function (it) {
      return '<figure><img class="photo-img" src="' + esc(photoUrl(it.image_path)) + '" alt="' + esc(it.title) + '" loading="lazy">' +
        '<figcaption>' + esc(it.title) + (it.caption ? '<span>' + esc(it.caption) + '</span>' : '') +
        (isMe ? '<button type="button" class="link-btn danger" data-action="del-photo" data-id="' + esc(it.id) + '">Quitar</button>' : '') +
        '</figcaption></figure>';
    }).join('') : '<div class="empty-tile">' + HOUSE + '<span>' + (isMe ? 'Sube fotos de tus trabajos con "+ Agregar foto".' : 'Todavía no hay fotos.') + '</span></div>';


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

    var keepText = $('ppText') ? $('ppText').value : '';
    $('profile').innerHTML =
      '<div class="profile-cover"></div>' +
      '<div class="profile-body">' +
        '<div class="profile-head">' +
          '<div class="profile-id">' + showAvatar(p, 112).replace('class="avatar av-112', 'class="avatar profile-avatar') +
            '<div><h2>' + esc(showName(p)) + '</h2><p><strong class="teal">' + esc(roleLabel(p)) + '</strong> · ' + esc(p.city) + ', FL' + (worker ? ' ' + availPill(p) : '') + '</p></div>' +
          '</div>' +
          '<div class="profile-actions">' + actions + '</div>' +
        '</div>' +
        (p.bio || p.short ? '<p class="bio">' + esc(p.bio || p.short) + '</p>' : (isMe ? '<p class="bio muted">Cuéntale a la red quién eres: toca "Editar perfil".</p>' : '')) +
        (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') +
        '<div><div class="block-head"><h3>' + (worker ? 'Fotos de mis trabajos' : 'Portafolio') + '</h3>' +
          (isMe ? '<button type="button" class="btn btn-outline btn-sm" data-action="add-photo">+ Agregar foto</button>' : '') + '</div><div class="portfolio">' + portfolio + '</div></div>' +

        '<div class="collab-box">' +
          '<div class="block-head"><h3>' + (worker ? 'Trabajé con' : 'Colaboraciones') + '</h3><span>' + (worker ? 'GCs y contratistas que lo confirmaron' : 'Personas con quienes ' + esc(isMe ? 'has' : first + ' ha') + ' trabajado') + '</span></div>' +
          '<div class="collabs">' + collabsHtml + '</div>' +
          (isMe ? '<form class="collab-form" id="collabForm">' +
            '<label class="field">Agregar colaborador<input type="text" id="collabInput" list="memberNames" maxlength="80" placeholder="Nombre de la persona" autocomplete="off"></label>' +
            '<button type="submit" class="btn btn-dark">+ Agregar</button></form>' +
            '<p class="small" style="margin-top:10px">Si la persona es miembro, la colaboración queda pendiente hasta que la confirme.</p>' : '') +
        '</div>' +
        (worker || viewerWorker ? '' : '<div class="profile-posts"><div class="block-head"><h3>Publicaciones <span>· ' + d.posts.length + '</span></h3></div>' +
          '<div class="feed-layout">' +
            (isMe ? profileComposer() : '') +
            '<div class="feed">' + (d.posts.length ? d.posts.map(function (x) { return postCard(x, true); }).join('')
              : '<div class="empty">' + (isMe ? 'Todavía no has publicado. Comparte un proyecto, un trabajo terminado o una oportunidad.' : esc(first) + ' todavía no ha publicado.') + '</div>') +
            '</div>' +
          '</div>' +
        '</div>') +
      '</div>';
    if ($('ppText') && keepText) $('ppText').value = keepText;
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
  var VIEWS = ['inicio', 'perfil', 'miembros', 'mensajes', 'publicaciones', 'crear', 'bolsa', 'contactos'];
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
    if (r.view === 'crear') setKind(r.id === 'trabajador' ? 'worker' : kindChosen());
    if (amWorker() && (r.view === 'miembros' || r.view === 'publicaciones')) { location.replace('#/bolsa'); return; }
    if (r.view === 'bolsa') {
      state.jobTab = r.id === 'trabajadores' ? 'trabajadores' : 'ofertas';
      renderJobs();
    }
    if ((r.view === 'mensajes' || r.view === 'contactos') && !state.user) { location.replace('#/'); return; }
    if (r.view === 'contactos') renderContacts();
    if (r.view === 'mensajes') {
      // Con conversación abierta (#/mensajes/<id>) o en la lista de chats
      document.body.dataset.chat = r.id ? 'open' : 'list';
      if (r.id) openChat(r.id);
      else if (isPhone()) { state.active = null; renderMessenger(); }
    } else {
      document.body.dataset.chat = 'list';
    }
    document.body.dataset.view = r.view;
    renderNav(r.view);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  function msgBtn(id, cls) {
    return '<a href="#/mensajes" class="btn ' + cls + '" data-action="open-chat" data-id="' + esc(id) + '">Enviar mensaje</a>';
  }

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
          '<span class="req-text"><a href="#/perfil" data-action="open-profile" data-id="' + esc(p.id) + '">' + esc(p.name) + '</a> ' + (amWorker() ? 'quiere contactarte por trabajo' : 'quiere conectar contigo') + '<small>' + esc(roleLabel(p) + ' · ' + p.city) + '</small></span>' +
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

    var all = partnerIds().map(function (id) {
      var t = threadWith(id); var last = t[t.length - 1];
      return { id: id, last: last, at: last ? last.created_at : '' };
    }).sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
    var ids = all.filter(function (x) { return !isMsgRequest(x.id); });
    var reqs = all.filter(function (x) { return isMsgRequest(x.id); });

    $('chatList').innerHTML = (ids.length ? ids.map(chatRow).join('') : '<p class="chat-none">Tus conversaciones aparecen aquí. Escríbele a alguien desde su perfil.</p>') +
      (reqs.length ? '<div class="chat-req-head">Solicitudes de mensajes <span>' + reqs.length + '</span></div>' + reqs.map(chatRow).join('') : '');

    function chatRow(x) {
      var p = state.byId[x.id];
      var unread = state.msgs.filter(function (m) { return m.sender_id === x.id && m.recipient_id === me() && !m.read_at; }).length;
      var preview = state.typingFrom[x.id] ? 'Escribiendo…' : x.last ? (x.last.sender_id === me() ? 'Tú: ' : '') + x.last.body : 'Nuevo contacto · salúdalo';
      return '<button type="button" class="chat-row' + (x.id === state.active ? ' active' : '') + '" data-action="open-chat" data-id="' + esc(x.id) + '">' +
        avatar(p, 44) +
        '<span class="chat-row-body">' +
          '<span class="chat-row-line"><strong>' + esc(p.name) + '</strong><span class="time">' + esc(x.last ? fmtTime(x.last.created_at) : '') + '</span></span>' +
          '<span class="chat-row-role"><span class="role-txt">' + esc(roleLabel(p)) + '</span>' +
            '<span class="city-txt">' + PIN.replace(/width="16" height="16"/, 'width="13" height="13"') + esc(p.city) + '</span></span>' +
          '<span class="chat-row-line"><span class="preview">' + esc(preview) + '</span>' +
          (unread ? '<span class="badge">' + unread + '</span>' : '') + '</span>' +
        '</span></button>';
    }

    var act = state.active && state.byId[state.active] && state.active !== me() ? state.active : null;
    $('chatHeader').hidden = !act;
    $('chatMessages').hidden = !act;
    $('chatForm').hidden = !act;
    $('chatEmpty').hidden = !!act;
    if (!act) return;

    var p = state.byId[act];
    $('chatHeader').innerHTML =
      '<button type="button" class="chat-back" data-action="chat-back" aria-label="Volver a los chats">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      avatar(p, 44) +
      '<span class="txt"><strong>' + esc(p.name) + '</strong><small>' + esc(roleLabel(p) + ' · ' + p.city) + '</small></span>' +
      contactButton(p);

    var t = threadWith(act);
    var last = t[t.length - 1];
    var html = t.length ? t.map(function (m) {
      return '<div class="msg' + (m.sender_id === me() ? ' me' : '') + '"><div class="bubble">' + esc(m.body) +
        '<time>' + esc(fmtTime(m.created_at)) + '</time></div></div>';
    }).join('') : '<p class="chat-first">Escribe el primer mensaje.' + (theyWrote(act) ? '' : ' Si ' + esc(firstName(p)) + ' nunca te ha escrito, le llegará como solicitud de mensaje.') + '</p>';
    if (isMsgRequest(act)) {
      html = '<div class="req-banner"><p><strong>' + esc(firstName(p)) + ' te escribió por primera vez.</strong> Si respondes o aceptas, la conversación pasa a tus chats.</p>' +
        '<span><button type="button" class="btn btn-primary btn-sm" data-action="accept-chat" data-id="' + esc(act) + '">Aceptar</button>' +
        '<button type="button" class="btn btn-ghost" data-action="ignore-chat" data-id="' + esc(act) + '">Ignorar</button></span></div>' + html;
    }
    var typing = !!state.typingFrom[act];
    if (last && last.sender_id === me() && !typing) {
      html += last.read_at
        ? '<div class="status">' + avatar(p, 16) + 'Visto</div>'
        : '<div class="status">Enviado</div>';
    }
    if (typing) html += '<div class="typing">' + esc(firstName(p)) + ' está escribiendo…</div>';
    var canWrite = canMessage(act);
    $('chatForm').hidden = !canWrite;
    if (!canWrite) html += '<p class="chat-first">Solo puedes responder cuando ' + esc(firstName(p)) + ' te escriba.</p>';
    var box = $('chatMessages');
    var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.innerHTML = html;
    if (nearBottom || box.dataset.chat !== act) box.scrollTop = box.scrollHeight;
    box.dataset.chat = act;
  }

  // Botón dentro del chat: agregar a contactos
  ICON_ADD = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M2.5 21c.7-4 3.7-6.5 7.5-6.5 1.6 0 3 .4 4.2 1.2"/><path d="M19 14v6M16 17h6"/></svg>';
  ICON_IN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M2.5 21c.7-4 3.7-6.5 7.5-6.5 1.6 0 3 .4 4.2 1.2"/><path d="M15.5 18l2 2 4-4"/></svg>';
  function contactButton(p) {
    if (isContact(p.id)) return '<a href="#/contactos" class="chat-contact on" title="Está en tus contactos">' + ICON_IN + '<span class="lbl">En tus contactos</span></a>';
    return '<button type="button" class="chat-contact act" data-action="connect" data-id="' + esc(p.id) + '" title="Agregar a contactos" aria-label="Agregar a ' + esc(p.name) + ' a contactos">' + ICON_ADD + '<span class="lbl">Agregar a contactos</span></button>';
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

  function isPhone() { return window.matchMedia('(max-width: 640px)').matches; }
  function chatIsOnScreen() {
    return document.visibilityState === 'visible' && parseRoute().view === 'mensajes' &&
      (!isPhone() || document.body.dataset.chat === 'open');
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
    $('typeChips').innerHTML = typeChipsHtml();
  }

  function thumbsHtml() {
    return state.postFiles.map(function (f, i) {
      return '<span class="thumb"><img src="' + esc(f.url) + '" alt=""><button type="button" class="x-btn" aria-label="Quitar foto" data-action="drop-post-photo" data-index="' + i + '">×</button></span>';
    }).join('');
  }
  function renderPostPreview() {
    $('postPhotosPreview').innerHTML = thumbsHtml();
    if ($('ppPreview')) $('ppPreview').innerHTML = thumbsHtml();
  }
  function typeChipsHtml() {
    return TYPES.map(function (t) {
      return '<button type="button" class="type-chip" data-action="pick-type" data-type="' + esc(t) + '" aria-pressed="' + (t === state.postType) + '">' + esc(t) + '</button>';
    }).join('');
  }
  function profileComposer() {
    return '<form id="ppForm" class="card composer">' +
      '<strong>Nueva publicación</strong>' +
      '<div class="type-chips" role="group" aria-label="Tipo de publicación">' + typeChipsHtml() + '</div>' +
      '<label class="field">Mensaje<textarea id="ppText" rows="4" maxlength="2000" placeholder="Ej.: Busco electricista en Tampa para una remodelación en diciembre."></textarea></label>' +
      '<div id="ppPreview" class="thumbs">' + thumbsHtml() + '</div>' +
      '<div class="composer-actions">' +
        '<label class="btn btn-dashed file-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>Agregar fotos' +
        '<input id="ppPhotos" class="post-photos-input" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>' +
        '<button type="submit" class="btn btn-primary">Publicar</button>' +
      '</div></form>';
  }

  function renderPosts() {
    if (!state.posts.length) {
      $('feed').innerHTML = '<div class="empty">Todavía no hay publicaciones. Comparte tu primer proyecto u oportunidad.</div>';
      return;
    }
    $('feed').innerHTML = state.posts.map(postCard).join('');
  }

  function postCard(post, inProfile) {
      var a = state.byId[post.author_id] || { id: post.author_id, name: 'Miembro', profession: '', city: '' };
      var guest = !state.user;
      var tc = TYPE_COLORS[post.type] || TYPE_COLORS['Proyecto'];
      var meta = [roleLabel(a), a.city, relTime(post.created_at)].filter(Boolean).join(' · ');
      var photos = post.photo_paths && post.photo_paths.length ? '<div class="post-photos">' + post.photo_paths.map(function (ph) {
        return '<img class="post-photo" src="' + esc(photoUrl(ph)) + '" alt="Foto de la publicación" loading="lazy">';
      }).join('') + '</div>' : '';
      var isMine = post.author_id === me();
      var connected = !isMine && canMessage(post.author_id);
      return '<article class="card post">' +
        '<div class="post-head"><div class="post-author">' + showAvatar(a, 46) +
          '<div><p class="name">' + esc(showName(a)) + '</p><p class="meta">' + esc(meta) + '</p></div></div>' +
          '<span class="type-badge" style="background:' + tc.bg + ';color:' + tc.fg + '">' + esc(post.type) + '</span></div>' +
        '<p class="post-text">' + esc(post.body) + '</p>' + photos +
        '<div class="post-actions">' +
          (guest ? '<a href="#/crear" class="btn btn-soft btn-sm">Crea tu perfil para ver quién es</a>'
            : isMine ? '<button type="button" class="btn btn-ghost" data-action="del-post" data-id="' + esc(post.id) + '">Borrar</button>'
            : (inProfile === true ? '' : '<a href="#/perfil" class="btn btn-soft btn-sm" data-action="open-profile" data-id="' + esc(a.id) + '">Ver perfil</a>') +
              (connected ? '<a href="#/mensajes" class="btn btn-ghost" data-action="open-chat" data-id="' + esc(a.id) + '">Enviar mensaje</a>' : '')) +
        '</div></article>';
  }

  // ---------- Render: crear perfil ----------
  function renderCreate() {
    var p = myProfile();
    $('signupForm').hidden = !!state.user;
    $('signedInBox').hidden = !state.user;
    var view = p || {
      id: null,
      name: $('cName').value.trim() || 'Tu nombre',
      profession: kindChosen() === 'worker' ? WORKER : $('cProf').value,
      trade: $('cTrade').value,
      title: kindChosen() === 'worker' ? '' : $('cTitle').value.trim(),
      city: $('cCity').value.trim() || 'Tu ciudad',
      bio: $('cDesc').value.trim() || 'Cuéntale a la red qué haces y dónde trabajas.'
    };
    $('preview').innerHTML =
      '<div class="member-top">' + avatar(p ? view : { name: view.name }, 56) +
      '<div><h3>' + esc(view.name) + '</h3><p class="role">' + esc(roleLabel(view)) + '</p></div></div>' +
      '<p class="city">' + PIN + esc(view.city) + ', FL</p>' +
      '<p class="short clamp">' + esc(view.bio || view.short || 'Miembro de la red.') + '</p>';
  }

  function renderAll() {
    document.body.classList.toggle('logged-in', !!state.user);
    document.body.classList.toggle('is-worker', amWorker());
    renderHeader();
    renderMembers();
    renderProfile();
    renderRequests();
    renderMessenger();
    renderPosts();
    renderCreate();
    renderJobs();
    renderContacts();
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
        if (!state.byId[row.sender_id] || !state.byId[row.recipient_id]) {
          loadProfiles().then(function () { renderMessenger(); renderHeader(); });
        }
        if (payload.eventType === 'INSERT' && row.sender_id === state.active && row.recipient_id === me() && chatIsOnScreen()) {
          markRead(row.sender_id);
        }
        renderMessenger(); renderHeader();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, async function () {
        await loadConnections();
        renderHeader(); renderRequests(); renderMessenger(); renderPosts();
        if (state.sel) { await loadSelected(); renderProfile(); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, async function () {
        await Promise.all([loadApps(), loadProfiles()]);
        renderJobs();
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
        if (!from || !(statusWith(from) === 'connected' || threadWith(from).length)) return;
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
      await Promise.all([loadConnections(), loadMessages(), loadCollabRequests(), loadApps(), loadJobs(), loadChatPrefs()]);
      subscribe();
    } else {
      unsubscribe();
      state.conns = []; state.msgs = []; state.collabReqs = []; state.apps = []; state.openApps = {}; state.chatPrefs = {};
      await Promise.all([loadProfiles(), loadJobs()]);
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
    $('eName').value = p.name; $('eProf').value = isWorker(p) ? PROFS[0] : p.profession; $('eCity').value = p.city;
    $('eProfField').hidden = isWorker(p); $('eTitleField').hidden = isWorker(p); $('eTradeField').hidden = !isWorker(p);
    $('eTrade').value = p.trade || 'Ayudante general';
    $('eTitle').value = p.title || ''; $('eBio').value = p.bio || p.short || ''; setAboutExample('eBio', p.profession);
    $('eAvatar').value = ''; $('editAvatar').innerHTML = avatar(p, 56);
    formMsg('editMsg', ''); openDialog('editDialog');
  }

  // ---------- Bolsa de trabajo ----------
  var ICON_CAL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  var ICON_CLOCK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var ICON_PEOPLE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.4 3.5 5.2"/></svg>';
  var ICON_SMALL_PIN = PIN.replace(/width="16" height="16"/, 'width="15" height="15"');

  function optionsAll(list, allLabel) {
    return [allLabel].concat(list).map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('');
  }
  function fillCityFilter(id, cities, current) {
    var sel = $(id);
    sel.innerHTML = optionsAll(cities, 'Todas');
    sel.value = cities.indexOf(current) >= 0 ? current : 'Todas';
    return sel.value;
  }
  function fmtStart(d) {
    if (!d) return '';
    var p = String(d).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // Registro: profesional o trabajador
  function kindChosen() {
    var r = document.querySelector('input[name="cKind"]:checked');
    return r ? r.value : 'pro';
  }
  function setKind(kind) {
    var r = document.querySelector('input[name="cKind"][value="' + kind + '"]');
    if (r) r.checked = true;
    var w = kind === 'worker';
    $('cProfField').hidden = w; $('cTitleField').hidden = w; $('cTradeField').hidden = !w;
    setAboutExample('cDesc', w ? WORKER : $('cProf').value);
    renderCreate();
  }

  function renderJobs() {
    if (!$('jobList')) return;
    var employer = amEmployer();
    var worker = amWorker();
    var guest = !state.user;
    var tab = employer && state.jobTab === 'trabajadores' ? 'trabajadores' : 'ofertas';
    $('newOfferBtn').hidden = !employer;
    $('jobTabs').hidden = !employer;
    document.querySelectorAll('#jobTabs .tab').forEach(function (t) {
      if (t.getAttribute('data-tab') === tab) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    $('offersPane').hidden = tab !== 'ofertas';
    $('workersPane').hidden = tab !== 'trabajadores';
    $('jobsSub').textContent = employer ? 'Publica lo que necesitas y encuentra gente para tu obra.'
      : worker ? 'Postúlate a las ofertas de GCs y contratistas en Florida.'
      : 'Ofertas de trabajo en construcción en Florida.';

    var banner = '';
    if (guest) {
      banner = '<div class="banner dark"><p><strong>¿Buscas trabajo en construcción?</strong> Crea tu perfil de trabajador gratis para postularte a las ofertas.</p>' +
        '<a href="#/crear/trabajador" class="btn btn-accent">Crear perfil de trabajador</a></div>';
    } else if (worker) {
      var mp = myProfile();
      banner = isAvailable(mp)
        ? '<div class="banner"><p><span class="avail on">Disponible</span> Los GCs y contratistas te ven como disponible para trabajar.</p><button type="button" class="btn btn-ghost" data-action="toggle-available">Ya no estoy disponible</button></div>'
        : '<div class="banner"><p><span class="avail">No disponible</span> Marca que estás disponible para que los GCs y contratistas te encuentren.</p><button type="button" class="btn btn-primary" data-action="toggle-available">Estoy disponible</button></div>';
    }
    $('jobBanner').innerHTML = banner;

    if (tab === 'ofertas') renderOffers(); else renderWorkers();
  }

  function renderOffers() {
    var employer = amEmployer();
    var cities = Array.from(new Set(state.jobs.map(function (o) { return o.city; }))).sort();
    state.jobCity = fillCityFilter('jobCity', cities, state.jobCity);
    $('jobTrade').value = state.jobTrade;
    var list = state.jobs.filter(function (o) {
      return (state.jobTrade === 'Todos' || o.trade === state.jobTrade) && (state.jobCity === 'Todas' || o.city === state.jobCity);
    });
    var mine = list.filter(function (o) { return o.employer_id === me(); });
    var others = list.filter(function (o) { return o.employer_id !== me() && o.status === 'abierta'; });
    var html = '';
    if (mine.length) {
      html += '<h3 class="job-group-title">Mis ofertas</h3>' + mine.map(offerCard).join('');
      if (others.length) html += '<h3 class="job-group-title">Otras ofertas</h3>';
    }
    html += others.map(offerCard).join('');
    if (!mine.length && !others.length) {
      html = '<div class="empty">' + (state.jobs.length ? 'No hay ofertas con ese filtro. Prueba otro oficio o ciudad.'
        : employer ? 'Todavía no hay ofertas. Publica la primera con "+ Publicar oferta".'
        : 'Todavía no hay ofertas de trabajo. Vuelve pronto.') + '</div>';
    }
    $('jobList').innerHTML = html;
  }

  function offerCard(o) {
    var emp = state.byId[o.employer_id] || { id: o.employer_id, name: 'Empresa', profession: '', city: '' };
    var mine = o.employer_id === me();
    var guest = !state.user;
    var worker = amWorker();
    var title = o.people > 1 ? 'Se buscan ' + o.people + ' personas' : 'Se busca 1 persona';
    var meta = '<span>' + ICON_SMALL_PIN + esc(o.city) + '</span>' +
      (o.start_date ? '<span>' + ICON_CAL + 'Empieza ' + esc(fmtStart(o.start_date)) + '</span>' : '') +
      (o.duration ? '<span>' + ICON_CLOCK + esc(o.duration) + '</span>' : '') +
      '<span>' + ICON_PEOPLE + o.people + (o.people > 1 ? ' personas' : ' persona') + '</span>';
    var apps = state.apps.filter(function (a) { return a.offer_id === o.id; });
    var applied = worker && apps.some(function (a) { return a.worker_id === me(); });

    var actions;
    if (mine) {
      actions = '<button type="button" class="btn btn-soft btn-sm" data-action="toggle-apps" data-id="' + esc(o.id) + '">' +
          (state.openApps[o.id] ? 'Ocultar interesados' : 'Ver interesados') + ' (' + apps.length + ')</button>' +
        (o.status === 'abierta'
          ? '<button type="button" class="btn btn-ghost" data-action="offer-status" data-id="' + esc(o.id) + '" data-status="cubierta">Marcar como cubierta</button>'
          : '<button type="button" class="btn btn-ghost" data-action="offer-status" data-id="' + esc(o.id) + '" data-status="abierta">Volver a abrir</button>') +
        '<button type="button" class="btn btn-ghost" data-action="del-offer" data-id="' + esc(o.id) + '">Borrar</button>';
    } else if (guest) {
      actions = '<a href="#/crear/trabajador" class="btn btn-primary btn-sm">Crea tu perfil para postularte</a>';
    } else if (worker) {
      actions = applied
        ? '<span class="applied">' + CHECK + 'Te postulaste</span><button type="button" class="btn btn-ghost" data-action="withdraw" data-id="' + esc(o.id) + '">Retirar</button>'
        : '<button type="button" class="btn btn-primary btn-sm" data-action="apply" data-id="' + esc(o.id) + '">Me interesa</button>';
    } else {
      actions = state.byId[emp.id] ? '<a href="#/perfil" class="btn btn-soft btn-sm" data-action="open-profile" data-id="' + esc(emp.id) + '">Ver quién publica</a>' : '';
    }

    var applicants = '';
    if (mine && state.openApps[o.id]) {
      applicants = '<div class="applicants">' + (apps.length ? apps.map(function (a) {
        var w = state.byId[a.worker_id];
        if (!w) return '';
        var connected = statusWith(w.id) === 'connected';
        return '<div class="applicant">' + avatar(w, 44) +
          '<span class="who"><strong>' + esc(w.name) + '</strong><small>' + esc(roleLabel(w) + ' · ' + w.city) + '</small></span>' +
          availPill(w) +
          '<span class="acts"><a href="#/perfil" class="btn btn-ghost" data-action="open-profile" data-id="' + esc(w.id) + '">Ver perfil</a>' +
          (connected
            ? '<a href="#/mensajes" class="btn btn-primary btn-sm" data-action="open-chat" data-id="' + esc(w.id) + '">Enviar mensaje</a>'
            : '<a href="#/mensajes" class="btn btn-primary btn-sm" data-action="open-chat" data-id="' + esc(w.id) + '">Enviar mensaje</a>') +
          '</span></div>';
      }).join('') : '<p class="small">Todavía no hay interesados. Te avisamos aquí cuando alguien se postule.</p>') + '</div>';
    }

    return '<article class="card job' + (o.status === 'cubierta' ? ' covered' : '') + '">' +
      '<div class="job-top"><span class="trade-badge">' + esc(o.trade) + '</span>' +
        '<span class="job-when">' + (o.status === 'cubierta' ? '<span class="status-badge">Cubierta</span> ' : '') + esc(relTime(o.created_at)) + '</span></div>' +
      '<h3>' + esc(title) + ' · ' + esc(o.trade) + '</h3>' +
      '<p class="job-meta">' + meta + '</p>' +
      (o.description ? '<p class="job-desc">' + esc(o.description) + '</p>' : '') +
      '<div class="job-employer">' + showAvatar(emp, 36) + '<span><strong>' + esc(mine ? 'Tú' : showName(emp)) + '</strong>' +
        '<small>' + esc([roleLabel(emp), emp.city].filter(Boolean).join(' · ')) + '</small></span></div>' +
      '<div class="job-actions">' + actions + '</div>' + applicants +
      '</article>';
  }

  function renderWorkers() {
    var all = state.profiles.filter(isWorker);
    var cities = Array.from(new Set(all.map(function (w) { return w.city; }))).sort();
    state.wkCity = fillCityFilter('wkCity', cities, state.wkCity);
    $('wkTrade').value = state.wkTrade;
    $('wkAvail').checked = state.wkAvail;
    var list = all.filter(function (w) {
      return (state.wkTrade === 'Todos' || w.trade === state.wkTrade) &&
        (state.wkCity === 'Todas' || w.city === state.wkCity) &&
        (!state.wkAvail || isAvailable(w));
    }).sort(function (a, b) { return (isAvailable(b) ? 1 : 0) - (isAvailable(a) ? 1 : 0); });
    $('wkCount').textContent = list.length + (list.length === 1 ? ' trabajador' : ' trabajadores') + (state.wkAvail ? ' disponibles' : '');
    $('workerGrid').innerHTML = list.length ? list.map(function (w) {
      var st = statusWith(w.id);
      return '<article class="card member-card">' +
        '<div class="member-top">' + avatar(w, 56) +
        '<div><h3>' + esc(w.name) + '</h3><p class="role">' + esc(w.trade || 'Construcción') + '</p></div></div>' +
        '<p class="city">' + PIN + esc(w.city) + ', FL ' + availPill(w) + '</p>' +
        '<p class="short clamp">' + esc(w.bio || w.short || 'Trabajador de construcción.') + '</p>' +
        '<div class="btn-row">' +
          '<a href="#/perfil" class="btn btn-soft" data-action="open-profile" data-id="' + esc(w.id) + '">Ver perfil</a>' +
          '<a href="#/mensajes" class="btn btn-primary" data-action="open-chat" data-id="' + esc(w.id) + '">Enviar mensaje</a>' +
        '</div></article>';
    }).join('') : '<div class="empty">' + (all.length ? 'No hay trabajadores con ese filtro. Prueba quitar "Solo disponibles" u otra ciudad.'
      : 'Todavía no hay trabajadores registrados. Comparte la página de la Bolsa de trabajo con la gente que conoces.') + '</div>';
  }

  async function toggleAvailable() {
    var p = myProfile(); if (!p) return;
    var on = !isAvailable(p);
    var res = await sb.from('profiles').update({ available: on, available_since: on ? new Date().toISOString() : null }).eq('id', me());
    if (res.error) return toast(errText(res.error));
    await loadProfiles();
    renderAll();
    toast(on ? 'Listo: apareces como disponible por ' + AVAIL_DAYS + ' días.' : 'Listo: ya no apareces como disponible.');
  }

  function openOfferDialog() {
    $('offerForm').reset();
    var p = myProfile();
    if (p) $('oCity').value = p.city;
    $('oPeople').value = 1;
    formMsg('offerMsg', '');
    openDialog('offerDialog');
  }

  // ---------- Acciones ----------
  async function connect(id) {
    if (!state.user) return openLogin();
    if (isContact(id)) return;
    var res = await sb.from('contacts').insert({ owner_id: me(), contact_id: id }).select().single();
    if (res.error) return toast(errText(res.error));
    state.contacts[id] = res.data;
    renderProfile(); renderMessenger(); renderContacts();
    toast('Agregado a Mis contactos. Solo tú lo ves.');
  }
  async function removeContact(id) {
    var p = state.byId[id];
    if (!confirmAction('¿Quitar a ' + (p ? p.name : 'esta persona') + ' de tus contactos?')) return;
    var res = await sb.from('contacts').delete().eq('owner_id', me()).eq('contact_id', id);
    if (res.error) return toast(errText(res.error));
    delete state.contacts[id];
    renderContacts(); renderProfile(); renderMessenger();
  }

  // ---------- Mis contactos ----------
  function renderContacts() {
    if (!$('ctList') || !state.user) return;
    var all = Object.keys(state.contacts).map(function (id) { return state.byId[id]; }).filter(Boolean);
    var cities = Array.from(new Set(all.map(function (p) { return p.city; }))).sort();
    state.ctCity = fillCityFilter('ctCity', cities, state.ctCity);
    var q = state.ctSearch.trim().toLowerCase();
    var list = all.filter(function (p) {
      var note = (state.contacts[p.id].note || '');
      var hay = (p.name + ' ' + roleLabel(p) + ' ' + p.city + ' ' + note).toLowerCase();
      return (!q || hay.indexOf(q) >= 0) &&
        (state.ctProf === 'Todas' || p.profession === state.ctProf) &&
        (state.ctCity === 'Todas' || p.city === state.ctCity);
    }).sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); });
    $('ctCount').textContent = all.length + (all.length === 1 ? ' contacto' : ' contactos') + (list.length !== all.length ? ' · ' + list.length + ' con este filtro' : '');
    if (!all.length) {
      $('ctList').innerHTML = '<div class="empty">Todavía no tienes contactos. Agrégalos desde su perfil o desde un chat con el botón <strong>"Agregar a contactos"</strong>.</div>';
      return;
    }
    $('ctList').innerHTML = list.length ? list.map(function (p) {
      var c = state.contacts[p.id];
      var editing = state.editNote === p.id;
      return '<article class="card ct-row">' +
        '<a href="#/perfil" class="ct-who" data-action="open-profile" data-id="' + esc(p.id) + '">' + avatar(p, 48) +
          '<span><strong>' + esc(p.name) + '</strong><small class="teal">' + esc(roleLabel(p)) + '</small><small>' + PIN.replace(/width="16" height="16"/, 'width="13" height="13"') + esc(p.city) + '</small></span></a>' +
        (editing
          ? '<form class="ct-note-form" data-id="' + esc(p.id) + '"><textarea id="ctNoteInput" rows="2" maxlength="500" placeholder="Ej.: Hizo la cocina de Belleview. Buen precio, puntual.">' + esc(c.note || '') + '</textarea>' +
            '<span><button type="submit" class="btn btn-primary btn-sm">Guardar</button><button type="button" class="btn btn-ghost" data-action="cancel-note">Cancelar</button></span></form>'
          : '<p class="ct-note' + (c.note ? '' : ' empty-note') + '">' + (c.note ? esc(c.note) : 'Sin nota') + '</p>') +
        '<div class="ct-actions">' +
          (canMessage(p.id) ? '<a href="#/mensajes" class="btn btn-primary btn-sm" data-action="open-chat" data-id="' + esc(p.id) + '">Mensaje</a>' : '') +
          (editing ? '' : '<button type="button" class="btn btn-soft btn-sm" data-action="edit-note" data-id="' + esc(p.id) + '">' + (c.note ? 'Editar nota' : 'Agregar nota') + '</button>') +
          '<button type="button" class="btn btn-ghost" data-action="remove-contact" data-id="' + esc(p.id) + '">Quitar</button>' +
        '</div></article>';
    }).join('') : '<div class="empty">Nadie coincide con esa búsqueda.</div>';
    if (editing()) setTimeout(function () { var t = $('ctNoteInput'); if (t) t.focus(); }, 30);
    function editing() { return !!state.editNote && list.some(function (p) { return p.id === state.editNote; }); }
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
      case 'remove-contact': await removeContact(id); break;
      case 'edit-note': state.editNote = id; renderContacts(); break;
      case 'cancel-note': state.editNote = null; renderContacts(); break;
      case 'accept-conn': el.disabled = true; await acceptConn(id); break;
      case 'reject-conn': el.disabled = true; await rejectConn(id); break;
      case 'open-chat':
        e.preventDefault();
        state.chatFromList = parseRoute().view === 'mensajes' && !parseRoute().id;
        go('#/mensajes/' + id);
        if (!isPhone()) setTimeout(function () { $('chatInput').focus({ preventScroll: true }); }, 200);
        break;
      case 'accept-chat':
        await setChatPref(id, 'accepted');
        renderMessenger();
        break;
      case 'ignore-chat':
        await setChatPref(id, 'ignored');
        state.active = null;
        renderMessenger(); renderHeader();
        location.replace('#/mensajes');
        toast('Conversación ignorada. No te avisaremos de sus mensajes.');
        break;
      case 'chat-back':
        // En el teléfono: volver a la lista de conversaciones
        if (state.chatFromList) { state.chatFromList = false; history.back(); }
        else location.replace('#/mensajes');
        break;
      case 'new-offer': openOfferDialog(); break;
      case 'toggle-available': el.disabled = true; await toggleAvailable(); break;
      case 'toggle-apps': state.openApps[id] = !state.openApps[id]; renderJobs(); break;
      case 'apply': {
        el.disabled = true;
        var ra = await sb.from('job_applications').insert({ offer_id: id, worker_id: me() }).select().single();
        if (ra.error) { el.disabled = false; return toast(errText(ra.error)); }
        state.apps.push(ra.data);
        renderJobs();
        toast('Te postulaste. Si les interesa, te escribirán por Mensajes.');
        break;
      }
      case 'withdraw': {
        var rw = await sb.from('job_applications').delete().eq('offer_id', id).eq('worker_id', me());
        if (rw.error) return toast(errText(rw.error));
        state.apps = state.apps.filter(function (a) { return !(a.offer_id === id && a.worker_id === me()); });
        renderJobs();
        break;
      }
      case 'offer-status': {
        var rs = await sb.from('job_offers').update({ status: el.getAttribute('data-status') }).eq('id', id);
        if (rs.error) return toast(errText(rs.error));
        await loadJobs(); renderJobs();
        toast(el.getAttribute('data-status') === 'cubierta' ? 'Oferta marcada como cubierta: ya no aparece para los trabajadores.' : 'La oferta está abierta otra vez.');
        break;
      }
      case 'del-offer': {
        if (!confirmAction('¿Borrar esta oferta de trabajo?')) return;
        var rd = await sb.from('job_offers').delete().eq('id', id);
        if (rd.error) return toast(errText(rd.error));
        state.jobs = state.jobs.filter(function (o) { return o.id !== id; });
        renderJobs();
        break;
      }
      case 'contact-app': {
        el.disabled = true;
        var rc = await sb.rpc('contact_applicant', { p_application: id });
        if (rc.error) { el.disabled = false; return toast(errText(rc.error)); }
        await loadConnections();
        renderAll();
        go('#/mensajes/' + el.getAttribute('data-worker'));
        break;
      }
      case 'new-post':
        e.preventDefault();
        go('#/publicaciones');
        setTimeout(function () { $('postText').focus(); }, 250);
        break;
      case 'pick-type':
        state.postType = el.getAttribute('data-type');
        document.querySelectorAll('.type-chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-type') === state.postType)); });
        break;
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
        var post = state.posts.concat((state.selData && state.selData.posts) || []).filter(function (x) { return x.id === id; })[0];
        var r4 = await sb.from('posts').delete().eq('id', id);
        if (r4.error) return toast(errText(r4.error));
        if (post && post.photo_paths.length) sb.storage.from(C.PHOTO_BUCKET).remove(post.photo_paths);
        state.posts = state.posts.filter(function (x) { return x.id !== id; });
        if (state.selData && state.selData.posts) state.selData.posts = state.selData.posts.filter(function (x) { return x.id !== id; });
        renderPosts(); renderProfile();
        break;
      }
    }
  });

  function confirmAction(text) { return window.confirm(text); }

  // Guardar la nota privada de un contacto
  document.addEventListener('submit', async function (e) {
    if (!e.target.classList.contains('ct-note-form')) return;
    e.preventDefault();
    var id = e.target.getAttribute('data-id');
    var note = $('ctNoteInput').value.trim() || null;
    var res = await sb.from('contacts').update({ note: note }).eq('owner_id', me()).eq('contact_id', id);
    if (res.error) return toast(errText(res.error));
    state.contacts[id].note = note;
    state.editNote = null;
    renderContacts();
  });

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
          profession: kindChosen() === 'worker' ? WORKER : $('cProf').value,
          trade: kindChosen() === 'worker' ? $('cTrade').value : null,
          city: $('cCity').value.trim(),
          title: kindChosen() === 'worker' ? '' : $('cTitle').value.trim(),
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
        name: $('eName').value.trim(), city: $('eCity').value.trim(),
        bio: $('eBio').value.trim() || null,
        short: $('eBio').value.trim().slice(0, 160) || null
      };
      if (amWorker()) { upd.trade = $('eTrade').value; }
      else { upd.profession = $('eProf').value; upd.title = $('eTitle').value.trim() || null; }
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

  function addPostFiles(input) {
    var files = Array.from(input.files || []);
    files.forEach(function (f) {
      if (state.postFiles.length < 4) state.postFiles.push({ file: f, url: URL.createObjectURL(f) });
    });
    if (files.length && state.postFiles.length >= 4) toast('Máximo 4 fotos por publicación.');
    input.value = '';
    renderPostPreview();
  }
  $('postPhotos').addEventListener('change', function () { addPostFiles(this); });
  document.addEventListener('change', function (e) { if (e.target.id === 'ppPhotos') addPostFiles(e.target); });

  async function submitPost(form, textEl) {
    if (!state.user) return openLogin();
    var text = textEl.value.trim();
    if (!text) return toast('Escribe algo para publicar.');
    busy(form, true);
    try {
      var paths = [];
      for (var i = 0; i < state.postFiles.length; i++) paths.push(await uploadPhoto(state.postFiles[i].file, 'posts'));
      var res = await sb.from('posts').insert({ author_id: me(), type: state.postType, body: text, photo_paths: paths }).select().single();
      if (res.error) throw res.error;
      state.posts.unshift(res.data);
      if (state.sel === me() && state.selData && state.selData.posts) state.selData.posts.unshift(res.data);
      textEl.value = '';
      state.postFiles.forEach(function (f) { URL.revokeObjectURL(f.url); });
      state.postFiles = [];
      renderPosts(); renderProfile(); renderPostPreview();
      toast('Publicado.');
    } catch (err) {
      toast(errText(err));
    } finally {
      if (document.body.contains(form)) busy(form, false);
    }
  }
  $('postForm').addEventListener('submit', function (e) { e.preventDefault(); submitPost(e.target, $('postText')); });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'ppForm') return;
    e.preventDefault();
    submitPost(e.target, $('ppText'));
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
    if (state.chatPrefs[id] === 'ignored') setChatPref(id, 'accepted');
    renderMessenger(); renderHeader();
  });

  $('chatInput').addEventListener('input', sendTyping);

  $('cProf').addEventListener('change', function () { setAboutExample('cDesc', this.value); });
  $('eProf').addEventListener('change', function () { setAboutExample('eBio', this.value); });
  ['cName', 'cProf', 'cCity', 'cTitle', 'cDesc'].forEach(function (id) {
    $(id).addEventListener('input', renderCreate);
    $(id).addEventListener('change', renderCreate);
  });

  // Bolsa de trabajo: filtros, registro y nueva oferta
  $('ctSearch').addEventListener('input', function (e) { state.ctSearch = e.target.value; renderContacts(); });
  $('ctProf').addEventListener('change', function (e) { state.ctProf = e.target.value; renderContacts(); });
  $('ctCity').addEventListener('change', function (e) { state.ctCity = e.target.value; renderContacts(); });
  $('jobTrade').addEventListener('change', function (e) { state.jobTrade = e.target.value; renderOffers(); });
  $('jobCity').addEventListener('change', function (e) { state.jobCity = e.target.value; renderOffers(); });
  $('wkTrade').addEventListener('change', function (e) { state.wkTrade = e.target.value; renderWorkers(); });
  $('wkCity').addEventListener('change', function (e) { state.wkCity = e.target.value; renderWorkers(); });
  $('wkAvail').addEventListener('change', function (e) { state.wkAvail = e.target.checked; renderWorkers(); });
  document.querySelectorAll('input[name="cKind"]').forEach(function (r) {
    r.addEventListener('change', function () { setKind(this.value); });
  });
  $('cTrade').addEventListener('change', renderCreate);
  $('offerForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    busy(e.target, true);
    var res = await sb.from('job_offers').insert({
      employer_id: me(),
      trade: $('oTrade').value,
      city: $('oCity').value.trim(),
      people: Math.max(1, Math.min(50, parseInt($('oPeople').value, 10) || 1)),
      start_date: $('oStart').value || null,
      duration: $('oDuration').value.trim() || null,
      description: $('oDesc').value.trim() || null
    });
    busy(e.target, false);
    if (res.error) return formMsg('offerMsg', errText(res.error));
    $('offerDialog').close();
    state.jobTab = 'ofertas';
    await loadJobs();
    if (parseRoute().view !== 'bolsa' || parseRoute().id) go('#/bolsa'); else renderJobs();
    toast('Oferta publicada. Los trabajadores ya la pueden ver.');
  });

  $('filterProf').addEventListener('change', function (e) { state.prof = e.target.value; renderMembers(); });
  $('filterCity').addEventListener('change', function (e) { state.city = e.target.value; renderMembers(); });

  document.addEventListener('visibilitychange', function () {
    if (state.active && chatIsOnScreen()) markRead(state.active);
  });

  // ---------- Inicio ----------
  $('filterProf').innerHTML = options(PROFS, true);
  $('filterCity').innerHTML = options([], true);
  $('cProf').innerHTML = options(PROFS, false);
  $('eProf').innerHTML = options(PROFS, false);
  setAboutExample('cDesc', $('cProf').value);
  ['cTrade', 'eTrade', 'oTrade'].forEach(function (id) { $(id).innerHTML = options(TRADES, false); });
  $('cTrade').value = 'Ayudante general';
  ['jobTrade', 'wkTrade'].forEach(function (id) { $(id).innerHTML = optionsAll(TRADES, 'Todos'); });
  $('jobCity').innerHTML = optionsAll([], 'Todas');
  $('ctProf').innerHTML = optionsAll(PROFS.concat([WORKER]), 'Todas');
  $('ctCity').innerHTML = optionsAll([], 'Todas');
  $('wkCity').innerHTML = optionsAll([], 'Todas');
  renderTypes();
  renderCreate();

  (async function start() {
    await Promise.all([loadProfiles(), loadPosts(), loadJobs()]);
    var s = await sb.auth.getSession();
    var sessionUser = s.data && s.data.session ? s.data.session.user : null;
    await handleUser(sessionUser);
    renderAll();
    if (!sessionUser) route(); // visitantes: abrir la página del enlace (#/miembros, #/perfil/…)
  })();
})();
