// Datos de ejemplo (ficticios). Más adelante esto se reemplaza por Supabase.
window.FPP_DATA = (function () {
  var TINTS = [
    { bg: '#DDF0EE', fg: '#0B5653' },
    { bg: '#FBE6D8', fg: '#8A3B12' },
    { bg: '#E7E4F7', fg: '#423A8A' },
    { bg: '#E4EDF7', fg: '#244A75' },
    { bg: '#F6EDCB', fg: '#6B5310' }
  ];
  function tile(t, d, i) { return { t: t, d: d, tint: i % TINTS.length }; }

  var MEMBERS = [
    { id: 'carlos', name: 'Carlos Méndez', prof: 'General Contractor', title: 'General Contractor (GC)', city: 'Ocala', tint: 0,
      short: 'Remodelaciones completas y casas nuevas en Marion County.',
      bio: 'GC con licencia en Florida y 15 años de experiencia. Dirijo remodelaciones completas para fix & flip y construcción de casas nuevas de 3 y 4 habitaciones. Trabajo con un equipo fijo de subcontratistas y entrego cronograma semanal a cada cliente.',
      portfolio: [tile('Cocina abierta', 'Remodelación · Ocala', 0), tile('Casa nueva 3/2', 'Construcción · Belleview', 3), tile('Baño principal', 'Remodelación · Ocala', 1)],
      collabs: [{ name: 'Laura Ríos', role: 'Realtor' }, { name: 'Diego Torres', role: 'Prestamista' }, { name: 'Sofía Herrera', role: 'Proveedora' }, { name: 'José Ramírez', role: 'Electricista' }] },
    { id: 'laura', name: 'Laura Ríos', prof: 'Realtor', title: 'Realtor', city: 'Orlando', tint: 1,
      short: 'Compra y venta de propiedades para inversión en Central Florida.',
      bio: 'Realtor bilingüe enfocada en inversionistas. Encuentro propiedades con potencial de remodelación y las vuelvo a vender cuando el GC termina. Más de 80 cierres en Orange y Osceola.',
      portfolio: [tile('Casa vendida en 9 días', 'Kissimmee', 1), tile('Townhouse remodelado', 'Orlando', 0)],
      collabs: [{ name: 'Carlos Méndez', role: 'GC' }, { name: 'Michael Brooks', role: 'Inversionista' }] },
    { id: 'diego', name: 'Diego Torres', prof: 'Prestamista', title: 'Prestamista · Hard money', city: 'Miami', tint: 3,
      short: 'Préstamos rápidos para fix & flip y construcción nueva.',
      bio: 'Financio proyectos de fix & flip y construcción en todo Florida. Aprobación en 72 horas y desembolsos por etapas de obra, coordinados con el GC del proyecto.',
      portfolio: [tile('Flip financiado', 'Hialeah', 3), tile('Construcción por etapas', 'Homestead', 4)],
      collabs: [{ name: 'Carlos Méndez', role: 'GC' }, { name: 'Michael Brooks', role: 'Inversionista' }, { name: 'Ana Castillo', role: 'Arquitecta' }] },
    { id: 'ana', name: 'Ana Castillo', prof: 'Arquitecto', title: 'Arquitecta', city: 'Tampa', tint: 2,
      short: 'Diseño residencial y planos para permisos en Hillsborough.',
      bio: 'Arquitecta con estudio propio. Diseño casas unifamiliares y dúplex, preparo planos para permisos y acompaño la obra con visitas quincenales.',
      portfolio: [tile('Dúplex moderno', 'Tampa Heights', 2), tile('Ampliación de cocina', 'Brandon', 0), tile('Casa de playa', 'St. Pete', 3)],
      collabs: [{ name: 'Diego Torres', role: 'Prestamista' }, { name: 'José Ramírez', role: 'Electricista' }] },
    { id: 'michael', name: 'Michael Brooks', prof: 'Inversionista', title: 'Inversionista', city: 'Ocala', tint: 4,
      short: 'Compro casas para remodelar y terrenos para construir.',
      bio: 'Invierto en 6 a 10 propiedades al año en Ocala y Gainesville. Busco GCs confiables y realtors que conozcan el mercado local.',
      portfolio: [tile('Flip terminado', 'Ocala', 4), tile('Terreno de 1 acre', 'Dunnellon', 3)],
      collabs: [{ name: 'Laura Ríos', role: 'Realtor' }, { name: 'Diego Torres', role: 'Prestamista' }] },
    { id: 'sofia', name: 'Sofía Herrera', prof: 'Proveedor', title: 'Proveedora · Gabinetes y pisos', city: 'Orlando', tint: 1,
      short: 'Gabinetes, cuarzo y pisos con precio de mayoreo para contratistas.',
      bio: 'Distribuidora de gabinetes, topes de cuarzo y pisos LVP. Entrego en obra en Central Florida y doy precio especial a contratistas de la red.',
      portfolio: [tile('Gabinetes shaker', 'Entrega en obra', 1), tile('Topes de cuarzo', 'Instalación', 2)],
      collabs: [{ name: 'Carlos Méndez', role: 'GC' }, { name: 'Valeria Gómez', role: 'Contratista' }] },
    { id: 'jose', name: 'José Ramírez', prof: 'Contratista', title: 'Contratista · Electricista', city: 'Tampa', tint: 0,
      short: 'Instalaciones eléctricas residenciales y paneles nuevos.',
      bio: 'Electricista con licencia. Hago instalaciones en casas nuevas, cambio de paneles y remodelaciones. Trabajo como subcontratista para GCs en Tampa y Ocala.',
      portfolio: [tile('Panel de 200 A', 'Tampa', 3), tile('Iluminación de cocina', 'Ocala', 0)],
      collabs: [{ name: 'Carlos Méndez', role: 'GC' }, { name: 'Ana Castillo', role: 'Arquitecta' }] },
    { id: 'valeria', name: 'Valeria Gómez', prof: 'Contratista', title: 'Contratista · Pintura y acabados', city: 'Jacksonville', tint: 2,
      short: 'Pintura interior y exterior, drywall y acabados finales.',
      bio: 'Mi equipo hace pintura, drywall y acabados para remodelaciones y casas listas para venta. Entregamos fotos del antes y después en cada trabajo.',
      portfolio: [tile('Exterior completo', 'Jacksonville', 4), tile('Interior listo para venta', 'Orange Park', 1)],
      collabs: [{ name: 'Sofía Herrera', role: 'Proveedora' }] }
  ];

  var CONTACTS = {
    carlos: ['laura', 'diego', 'sofia', 'jose', 'michael'],
    laura: ['carlos', 'michael', 'diego'],
    diego: ['carlos', 'michael', 'ana', 'laura'],
    ana: ['diego', 'jose'],
    michael: ['laura', 'diego', 'carlos'],
    sofia: ['carlos', 'valeria'],
    jose: ['carlos', 'ana'],
    valeria: ['sofia']
  };

  var POSTS = [
    { authorId: 'carlos', type: 'Trabajo realizado', time: 'Hace 2 h',
      text: 'Terminamos esta remodelación en Ocala: cocina abierta, pisos nuevos y baño principal. Gracias a Sofía Herrera por los gabinetes y a José Ramírez por la parte eléctrica.',
      photos: [tile('Cocina', '', 0), tile('Sala', '', 3), tile('Baño', '', 1)] },
    { authorId: 'michael', type: 'Oportunidad', time: 'Hace 5 h',
      text: 'Busco GC en Ocala o Gainesville para 2 casas fix & flip a partir de enero. Presupuesto de remodelación aprox. $45–60K por casa. Escríbanme si les interesa.',
      photos: [] },
    { authorId: 'ana', type: 'Proyecto', time: 'Ayer',
      text: 'Diseño en proceso: dúplex de 2 pisos en Tampa Heights. Buscamos realtor para la preventa y proveedor de ventanas de impacto.',
      photos: [tile('Plano fachada', '', 2)] }
  ];

  var CHATS = {
    laura: { unread: 0, seen: true, typing: false, msgs: [
      { me: false, text: 'Hola, vi tu perfil. Tengo un cliente buscando GC para un flip en Ocala.', time: '9:12' },
      { me: true, text: '¡Hola Laura! Claro, cuéntame más.', time: '9:20' },
      { me: false, text: 'Es una casa 3/2 en Belleview. ¿Puedes verla el jueves?', time: '9:24' }
    ] },
    diego: { unread: 1, seen: true, typing: false, msgs: [
      { me: true, text: 'Diego, ¿cuánto tarda la aprobación para un flip?', time: 'Ayer' },
      { me: false, text: 'Normalmente 72 horas si tienes el contrato y el presupuesto de obra.', time: 'Ayer' }
    ] }
  };

  return {
    TINTS: TINTS,
    MEMBERS: MEMBERS,
    CONTACTS: CONTACTS,
    POSTS: POSTS,
    CHATS: CHATS,
    CONNECTED: { laura: 'connected', diego: 'connected' },
    PROFS: ['General Contractor', 'Contratista', 'Prestamista', 'Realtor', 'Arquitecto', 'Inversionista', 'Proveedor'],
    CITIES: ['Miami', 'Orlando', 'Tampa', 'Ocala', 'Jacksonville'],
    TYPES: ['Proyecto', 'Trabajo realizado', 'Oportunidad'],
    TYPE_COLORS: {
      'Proyecto': { bg: '#DDF0EE', fg: '#0B5653' },
      'Trabajo realizado': { bg: '#FBE6D8', fg: '#8A3B12' },
      'Oportunidad': { bg: '#E7E4F7', fg: '#423A8A' }
    },
    DEMO_REPLIES: [
      '¡Perfecto! Déjame revisar y te confirmo hoy.',
      'Me interesa. ¿Cuándo podemos vernos en la obra?',
      'Gracias por escribir. Te mando los detalles en un rato.'
    ]
  };
})();
