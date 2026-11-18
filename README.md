# Florida Project Partners

**Hay pastel para todos: conectamos oportunidades para que todos crezcan juntos.**

Red profesional para la gente de bienes raíces y construcción en Florida: contratistas, general contractors (GC), prestamistas, realtors, arquitectos, inversionistas y proveedores.

## Qué hace

- Registro e inicio de sesión (correo y contraseña)
- Perfiles con foto, historia y portafolio de trabajos con fotos
- Directorio con filtros por profesión y ciudad
- Mis contactos: agenda privada (solo la ve su dueño) con buscador, filtros y nota por contacto
- Mensajes en tiempo real entre contactos: enviado, visto y escribiendo…
- Colaboraciones: las confirma la otra persona
- Publicaciones con hasta 4 fotos
- Bolsa de trabajo: trabajadores de construcción con oficio y disponibilidad; ofertas de GCs, contratistas e inversionistas; postulaciones con "Me interesa" y contacto directo

## Estructura

```
index.html           Página
css/styles.css       Estilos
js/config.js         Llaves públicas de Supabase
js/app.js            Lógica de la página
supabase/schema.sql              Base de datos, seguridad y fotos
supabase/002_bolsa_de_trabajo.sql  Trabajadores, ofertas y postulaciones
supabase/003_mensajes_sin_contacto.sql  Mensajes sin ser contactos y solicitudes de mensajes
supabase/004_mis_contactos.sql  Mis contactos: agenda privada con notas
```

## Puesta en marcha

1. En Supabase > SQL Editor, ejecuta en orden `supabase/schema.sql` y `supabase/002_bolsa_de_trabajo.sql` (ya aplicados en el proyecto actual).
2. En Supabase > Authentication > URL Configuration, pon como Site URL la dirección de la página.
3. Publica los archivos (GitHub Pages o tu hosting).

Nunca pongas la "secret key" o "service_role" en este repositorio.
