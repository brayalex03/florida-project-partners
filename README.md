# Florida Project Partners

**Hay pastel para todos: conectamos oportunidades para que todos crezcan juntos.**

Red profesional para la gente de bienes raíces y construcción en Florida: contratistas, general contractors (GC), prestamistas, realtors, arquitectos, inversionistas y proveedores.

## Qué hace

- Registro e inicio de sesión (correo y contraseña)
- Perfiles con foto, historia y portafolio de trabajos con fotos
- Directorio con filtros por profesión y ciudad
- Conectar: solicitud, aceptar o ignorar, y lista de contactos en cada perfil
- Mensajes en tiempo real entre contactos: enviado, visto y escribiendo…
- Colaboraciones: las confirma la otra persona
- Publicaciones con hasta 4 fotos

## Estructura

```
index.html           Página
css/styles.css       Estilos
js/config.js         Llaves públicas de Supabase
js/app.js            Lógica de la página
supabase/schema.sql  Base de datos, seguridad y fotos (se ejecuta una vez en Supabase)
```

## Puesta en marcha

1. En Supabase > SQL Editor, pega y ejecuta `supabase/schema.sql`.
2. En Supabase > Authentication > URL Configuration, pon como Site URL la dirección de la página.
3. Publica los archivos (GitHub Pages o tu hosting).

Nunca pongas la "secret key" o "service_role" en este repositorio.
