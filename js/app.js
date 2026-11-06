(function () {
  'use strict';
  var D = window.FPP_DATA;

  // ---------- Estado ----------
  var collabs = {};
  D.MEMBERS.forEach(function (m) { collabs[m.id] = m.collabs.slice(); });

  var state = {
    members: D.MEMBERS.slice(),
    prof: 'Todas',
    city: 'Todas',
    sel: 'carlos',
    collabs: collabs,
    conn: Object.assign({}, D.CONNECTED),
    chats: JSON.parse(JSON.stringify(D.CHATS)),
    active: 'laura',
    posts: D.POSTS.slice(),
    postType: 'Oportunidad',
    replyIndex: 0
  };

  // ---------- Utilidades ----------
  function $(id) { return document.getElementById(id); }
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
  function tint(i) { return D.TINTS[i % D.TINTS.length]; }
  function byId(id) { return state.members.filter(function (m) { return m.id === id; })[0]; }
  function status(id) { return state.conn[id] || 'none'; }
  function shortRole(m) { return m.title.split(' ·')[0]; }
  function nowTime() {
    var d = new Date(); var h = d.getHours(); var mi = d.getMinutes();
    return (h % 12 || 12) + ':' + (mi < 10 ? '0' : '') + mi;
  }
  function avatar(name, t, size) {
    return '<span class="avatar av-' + size + '" aria-hidden="true" style="background:' + t.bg + ';color:' + t.fg + '">' + esc(initials(name)) + '</span>';
  }
  var HOUSE = '<svg width="SIZE" height="SIZE" viewBox="0 0 64 64" fill="none" stroke="COLOR" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><path d="M8 30 L32 10 L56 30"/><path d="M14 26 L14 54 L50 54 L50 26"/><rect x="27" y="38" width="10" height="16"/></svg>';
  function house(size, color) { return HOUSE.replace(/SIZE/g, size).replace('COLOR', color); }
  var PIN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';

  function options(list, withAll) {
    return (withAll ? ['Todas'] : []).concat(list).map(function (o) {
      return '<option value="' + esc(o) + '">' + esc(o) + '</option>';
    }).join('');
  }

  // ---------- Directorio ----------
  function renderMembers() {
    var list = state.members.filter(function (m) {
      return (state.prof === 'Todas' || m.prof === state.prof) && (state.city === 'Todas' || m.city === state.city);
    });
    $('countLabel').textContent = list.length + (list.length === 1 ? ' profesional encontrado' : ' profesionales encontrados') + ' en Florida';
    $('emptyMembers').hidden = list.length > 0;
    $('memberGrid').innerHTML = list.map(function (m) {
      var n = state.collabs[m.id].length;
      return '<article class="card member-card">' +
        '<div class="member-top">' + avatar(m.name, tint(m.tint), 56) +
        '<div><h3>' + esc(m.name) + '</h3><p class="role">' + esc(m.title) + '</p></div></div>' +
        '<p class="city">' + PIN + esc(m.city) + ', FL</p>' +
        '<p class="short">' + esc(m.short) + '</p>' +
        '<p class="small">' + n + (n === 1 ? ' colaboración' : ' colaboraciones') + '</p>' +
        '<a href="#perfil" class="btn btn-soft" data-action="open-profile" data-id="' + esc(m.id) + '">Ver perfil</a>' +
        '</article>';
    }).join('');
  }

  // ---------- Perfil ----------
  function renderProfile() {
    var m = byId(state.sel);
    var t = tint(m.tint);
    var st = status(m.id);
    var first = m.name.split(' ')[0];
    var isMe = m.id === 'me';

    var actions = '';
    if (isMe) {
      actions = '<span class="pill-ok">' + CHECK + 'Este es tu perfil</span>';
    } else if (st === 'none') {
      actions = '<button type="button" class="btn btn-primary" data-action="connect">Conectar</button>' +
        '<button type="button" class="btn btn-disabled" disabled title="Conéctate para enviar mensajes">Enviar mensaje</button>';
    } else if (st === 'pending') {
      actions = '<button type="button" class="btn btn-pending" disabled>Solicitud enviada…</button>' +
        '<button type="button" class="btn btn-disabled" disabled>Enviar mensaje</button>';
    } else {
      actions = '<span class="pill-ok">' + CHECK + 'Conectados</span>' +
        '<a href="#mensajes" class="btn btn-primary" data-action="open-chat" data-id="' + esc(m.id) + '">Enviar mensaje</a>';
    }

    var contacts = (D.CONTACTS[m.id] || []).map(byId).filter(Boolean).map(function (c) {
      return { id: c.id, name: c.name, role: shortRole(c), t: tint(c.tint) };
    });
    if (st === 'connected' && !isMe) contacts.unshift({ id: null, name: 'Tú', role: 'Tu perfil', t: { bg: '#16232B', fg: '#FFFFFF' } });

    var portfolio = m.portfolio.length ? m.portfolio.map(function (p) {
      var pt = tint(p.tint);
      return '<figure><div class="photo" style="background:' + pt.bg + '">' + house(64, pt.fg) + '</div>' +
        '<figcaption>' + esc(p.t) + '<span>' + esc(p.d) + '</span></figcaption></figure>';
    }).join('') : '<p class="small">Todavía no hay fotos. Aquí aparecerán tus trabajos.</p>';

    var collabsHtml = state.collabs[m.id].map(function (c) {
      return '<span class="collab">' + avatar(c.name, { bg: '#DDF0EE', fg: '#0B5653' }, 28) +
        '<span><strong>' + esc(c.name) + '</strong> <span class="role-txt">· ' + esc(c.role) + '</span></span>' +
        (c.pending ? '<span class="tag-pending">Pendiente</span>' : '') + '</span>';
    }).join('') || '<p class="small">Aún no hay colaboraciones.</p>';

    $('profile').innerHTML =
      '<div class="profile-cover"></div>' +
      '<div class="profile-body">' +
        '<div class="profile-head">' +
          '<div class="profile-id">' +
            '<span class="avatar profile-avatar" aria-hidden="true" style="background:' + t.bg + ';color:' + t.fg + '">' + esc(initials(m.name)) + '</span>' +
            '<div><h2>' + esc(m.name) + '</h2><p><strong style="color:#0E6E6A">' + esc(m.title) + '</strong> · ' + esc(m.city) + ', FL</p></div>' +
          '</div>' +
          '<div class="profile-actions">' + actions + '</div>' +
        '</div>' +
        '<p class="bio">' + esc(m.bio) + '</p>' +
        (st !== 'connected' && !isMe ? '<p class="hint">Conéctate con ' + esc(first) + ' para poder enviarle mensajes.</p>' : '') +
        '<div><div class="block-head"><h3>Portafolio</h3></div><div class="portfolio">' + portfolio + '</div></div>' +
        '<div><div class="block-head"><h3>Contactos <span>· ' + contacts.length + (contacts.length === 1 ? ' contacto' : ' contactos') + '</span></h3>' +
          '<span>Personas conectadas con ' + esc(isMe ? 'tu perfil' : first) + '</span></div>' +
          '<div class="contacts">' + (contacts.map(function (c) {
            return '<a href="#perfil" class="contact"' + (c.id ? ' data-action="open-profile" data-id="' + esc(c.id) + '"' : '') + '>' +
              avatar(c.name, c.t, 36) + '<span class="txt"><strong>' + esc(c.name) + '</strong><small>' + esc(c.role) + '</small></span></a>';
          }).join('') || '<p class="small">Todavía sin contactos.</p>') + '</div></div>' +
        '<div class="collab-box">' +
          '<div class="block-head"><h3>Colaboraciones</h3><span>Personas con quienes ' + esc(isMe ? 'has' : first + ' ha') + ' trabajado</span></div>' +
          '<div class="collabs">' + collabsHtml + '</div>' +
          '<form class="collab-form" id="collabForm">' +
            '<label class="field">Agregar colaborador<input type="text" id="collabInput" placeholder="Nombre de la persona" autocomplete="off"></label>' +
            '<button type="submit" class="btn btn-dark">+ Agregar</button>' +
          '</form>' +
          '<p class="small" style="margin-top:10px">La colaboración aparece como pendiente hasta que la otra persona la confirma.</p>' +
        '</div>' +
      '</div>';
  }

  // ---------- Mensajes ----------
  function renderChats() {
    var ids = state.members.filter(function (m) { return m.id !== 'me' && status(m.id) === 'connected'; }).map(function (m) { return m.id; });
    var unreadTotal = 0;
    $('chatList').innerHTML = ids.length ? ids.map(function (id) {
      var m = byId(id); var ch = state.chats[id] || { msgs: [], unread: 0 };
      var last = ch.msgs[ch.msgs.length - 1];
      unreadTotal += ch.unread || 0;
      return '<button type="button" class="chat-row' + (id === state.active ? ' active' : '') + '" data-action="open-chat" data-id="' + esc(id) + '">' +
        avatar(m.name, tint(m.tint), 44) +
        '<span class="chat-row-body">' +
          '<span class="chat-row-line"><strong>' + esc(m.name) + '</strong><span class="time">' + esc(last ? last.time : '') + '</span></span>' +
          '<span class="chat-row-line"><span class="preview">' + esc(last ? (last.me ? 'Tú: ' : '') + last.text : 'Nuevo contacto · salúdalo') + '</span>' +
          (ch.unread ? '<span class="badge">' + ch.unread + '</span>' : '') + '</span>' +
        '</span></button>';
    }).join('') : '<p class="chat-none">Conéctate con alguien para empezar a chatear.</p>';

    var badge = $('unreadBadge');
    badge.hidden = unreadTotal === 0;
    badge.textContent = unreadTotal;

    var act = state.active && status(state.active) === 'connected' ? state.active : null;
    $('chatHeader').hidden = !act;
    $('chatMessages').hidden = !act;
    $('chatForm').hidden = !act;
    $('chatEmpty').hidden = !!act;
    if (!act) return;

    var m = byId(act); var ch = state.chats[act] || { msgs: [] };
    var last = ch.msgs[ch.msgs.length - 1];
    var first = m.name.split(' ')[0];
    $('chatHeader').innerHTML = avatar(m.name, tint(m.tint), 44) +
      '<span class="txt"><strong>' + esc(m.name) + '</strong><small>' + esc(m.title + ' · ' + m.city) + '</small></span>';

    var html = ch.msgs.length ? ch.msgs.map(function (x) {
      return '<div class="msg' + (x.me ? ' me' : '') + '"><div class="bubble">' + esc(x.text) + '<time>' + esc(x.time) + '</time></div></div>';
    }).join('') : '<p class="chat-first">Ya están conectados. Escribe el primer mensaje.</p>';
    if (last && last.me && !ch.seen) html += '<div class="status">Enviado</div>';
    if (last && last.me && ch.seen && !ch.typing) html += '<div class="status">' + avatar(m.name, tint(m.tint), 16) + 'Visto</div>';
    if (ch.typing) html += '<div class="typing">' + esc(first) + ' está escribiendo…</div>';
    var box = $('chatMessages');
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  }

  function openChat(id) {
    var ch = state.chats[id] || { msgs: [], seen: false, typing: false };
    ch.unread = 0;
    state.chats[id] = ch;
    state.active = id;
    renderChats();
  }

  function updChat(id, patch) {
    state.chats[id] = Object.assign({}, state.chats[id], patch);
    renderChats();
  }

  // ---------- Publicaciones ----------
  function renderTypes() {
    $('typeChips').innerHTML = D.TYPES.map(function (t) {
      return '<button type="button" class="type-chip" data-action="pick-type" data-type="' + esc(t) + '" aria-pressed="' + (t === state.postType) + '">' + esc(t) + '</button>';
    }).join('');
  }

  function renderPosts() {
    $('feed').innerHTML = state.posts.map(function (p) {
      var a = p.authorId ? byId(p.authorId) : null;
      var name = a ? a.name : p.name;
      var t = a ? tint(a.tint) : { bg: '#16232B', fg: '#FFFFFF' };
      var tc = D.TYPE_COLORS[p.type];
      var meta = (a ? a.title + ' · ' + a.city : 'Tu perfil · Florida') + ' · ' + p.time;
      var photos = p.photos.length ? '<div class="post-photos">' + p.photos.map(function (ph) {
        var pt = tint(ph.tint);
        return '<div class="post-photo" style="background:' + pt.bg + ';color:' + pt.fg + '">' + house(40, pt.fg) + esc(ph.t) + '</div>';
      }).join('') + '</div>' : '';
      return '<article class="card post">' +
        '<div class="post-head"><div class="post-author">' + avatar(name, t, 46) +
          '<div><p class="name">' + esc(name) + '</p><p class="meta">' + esc(meta) + '</p></div></div>' +
          '<span class="type-badge" style="background:' + tc.bg + ';color:' + tc.fg + '">' + esc(p.type) + '</span></div>' +
        '<p class="post-text">' + esc(p.text) + '</p>' + photos +
        '<div class="post-actions"><button type="button" class="btn btn-soft btn-sm">Me interesa</button>' +
        '<button type="button" class="btn btn-ghost">Comentar</button><button type="button" class="btn btn-ghost">Compartir</button></div>' +
        '</article>';
    }).join('');
  }

  // ---------- Crear perfil ----------
  function renderPreview() {
    var name = $('cName').value.trim() || 'Tu nombre';
    var desc = $('cDesc').value.trim() || 'Cuéntale a la red qué haces y dónde trabajas.';
    $('preview').innerHTML =
      '<div class="member-top">' + avatar(name, { bg: '#FBE6D8', fg: '#8A3B12' }, 56) +
      '<div><h3>' + esc(name) + '</h3><p class="role">' + esc($('cProf').value) + '</p></div></div>' +
      '<p class="city">' + PIN + esc($('cCity').value) + ', FL</p>' +
      '<p class="short">' + esc(desc) + '</p>' +
      '<p class="small">0 colaboraciones · listo para la primera</p>';
  }

  // ---------- Eventos ----------
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');

    if (action === 'open-profile') {
      state.sel = id;
      renderProfile();
    } else if (action === 'connect') {
      var target = state.sel;
      state.conn[target] = 'pending';
      renderProfile();
      // Demo: la otra persona "acepta" sola. En la versión real espera su respuesta.
      setTimeout(function () {
        state.conn[target] = 'connected';
        if (!state.chats[target]) state.chats[target] = { msgs: [], unread: 0, seen: false, typing: false };
        if (state.sel === target) renderProfile();
        renderChats();
      }, 1500);
    } else if (action === 'open-chat') {
      openChat(id);
    } else if (action === 'pick-type') {
      state.postType = el.getAttribute('data-type');
      renderTypes();
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.id === 'collabForm') {
      e.preventDefault();
      var name = $('collabInput').value.trim();
      if (!name) return;
      var match = state.members.filter(function (m) { return m.name.toLowerCase() === name.toLowerCase(); })[0];
      state.collabs[state.sel].push({ name: match ? match.name : name, role: match ? shortRole(match) : 'Miembro', pending: true });
      renderProfile();
      renderMembers();
      $('collabInput').focus();
    }
  });

  $('chatForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = state.active;
    var input = $('chatInput');
    var text = input.value.trim();
    if (!id || !text) return;
    var ch = state.chats[id] || { msgs: [], unread: 0 };
    ch.msgs = ch.msgs.concat([{ me: true, text: text, time: nowTime() }]);
    ch.seen = false; ch.typing = false;
    state.chats[id] = ch;
    input.value = '';
    renderChats();
    // Demo: simulación de lectura y respuesta. En la versión real llega del otro usuario.
    setTimeout(function () { updChat(id, { seen: true }); }, 1200);
    setTimeout(function () { updChat(id, { typing: true }); }, 2000);
    setTimeout(function () {
      state.replyIndex = (state.replyIndex + 1) % D.DEMO_REPLIES.length;
      var cur = state.chats[id];
      updChat(id, {
        typing: false,
        msgs: cur.msgs.concat([{ me: false, text: D.DEMO_REPLIES[state.replyIndex], time: nowTime() }]),
        unread: state.active === id ? 0 : (cur.unread || 0) + 1
      });
    }, 3800);
  });

  $('postForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('postText').value.trim();
    if (!text) return;
    var me = byId('me');
    state.posts.unshift(me
      ? { authorId: 'me', type: state.postType, time: 'Ahora', text: text, photos: [] }
      : { name: 'Tú', type: state.postType, time: 'Ahora', text: text, photos: [] });
    $('postText').value = '';
    renderPosts();
  });

  $('createForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('cName').value.trim();
    if (!name) return;
    var me = byId('me');
    var data = {
      id: 'me', name: name, prof: $('cProf').value, title: $('cProf').value, city: $('cCity').value, tint: 1,
      short: $('cDesc').value.trim() || 'Nuevo miembro de la red.',
      bio: $('cDesc').value.trim() || 'Nuevo miembro de la red.',
      portfolio: []
    };
    if (me) { Object.assign(me, data); } else { state.members.unshift(data); state.collabs.me = []; }
    state.sel = 'me';
    renderMembers();
    renderProfile();
    renderPosts();
    $('perfil').scrollIntoView({ behavior: 'smooth' });
  });

  ['cName', 'cProf', 'cCity', 'cDesc'].forEach(function (id) {
    $(id).addEventListener('input', renderPreview);
    $(id).addEventListener('change', renderPreview);
  });

  $('filterProf').addEventListener('change', function (e) { state.prof = e.target.value; renderMembers(); });
  $('filterCity').addEventListener('change', function (e) { state.city = e.target.value; renderMembers(); });

  // ---------- Inicio ----------
  $('filterProf').innerHTML = options(D.PROFS, true);
  $('filterCity').innerHTML = options(D.CITIES, true);
  $('cProf').innerHTML = options(D.PROFS, false);
  $('cCity').innerHTML = options(D.CITIES, false);
  $('cProf').value = 'Realtor';
  $('cCity').value = 'Orlando';

  renderMembers();
  renderProfile();
  renderChats();
  renderTypes();
  renderPosts();
  renderPreview();
})();
