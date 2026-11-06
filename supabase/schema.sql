-- =====================================================================
-- Florida Project Partners — base de datos
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Se ejecuta una sola vez.
-- =====================================================================

-- ---------- Tablas ----------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  profession  text not null check (profession in ('General Contractor','Contratista','Prestamista','Realtor','Arquitecto','Inversionista','Proveedor')),
  title       text check (char_length(title) <= 60),
  city        text not null check (char_length(city) between 1 and 60),
  short       text check (char_length(short) <= 160),
  bio         text check (char_length(bio) <= 1500),
  avatar_path text check (char_length(avatar_path) <= 300),
  created_at  timestamptz not null default now()
);

create table public.portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  caption     text check (char_length(caption) <= 120),
  image_path  text not null check (char_length(image_path) <= 300),
  created_at  timestamptz not null default now()
);
create index portfolio_items_profile on public.portfolio_items (profile_id, created_at desc);

create table public.connections (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  addressee_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','accepted')),
  created_at    timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index connections_pair on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 2000),
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);
create index messages_pair on public.messages (sender_id, recipient_id, created_at);
create index messages_unread on public.messages (recipient_id, read_at);

create table public.collaborations (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  collaborator_id    uuid references public.profiles(id) on delete cascade,
  collaborator_name  text not null check (char_length(collaborator_name) between 1 and 80),
  confirmed          boolean not null default false,
  created_at         timestamptz not null default now(),
  check (collaborator_id is null or collaborator_id <> profile_id)
);
create index collaborations_profile on public.collaborations (profile_id);
create index collaborations_collaborator on public.collaborations (collaborator_id);

create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('Proyecto','Trabajo realizado','Oportunidad')),
  body        text not null check (char_length(body) between 1 and 2000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 4),
  created_at  timestamptz not null default now()
);
create index posts_recent on public.posts (created_at desc);

-- ---------- Perfil automático al registrarse ----------

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p text := new.raw_user_meta_data->>'profession';
begin
  insert into public.profiles (id, name, profession, title, city, short, bio)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)), 80),
    case when p in ('General Contractor','Contratista','Prestamista','Realtor','Arquitecto','Inversionista','Proveedor') then p else 'Contratista' end,
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'title', '')), 60), ''),
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'city'), ''), 'Florida'), 60),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'short', '')), 160), ''),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'short', '')), 1500), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ¿Están conectadas estas dos personas? (se usa para permitir mensajes)
create function public.are_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester_id = a and c.addressee_id = b) or (c.requester_id = b and c.addressee_id = a))
  );
$$;
revoke execute on function public.are_connected(uuid, uuid) from public, anon;
grant execute on function public.are_connected(uuid, uuid) to authenticated;

-- ---------- Seguridad (RLS) ----------

alter table public.profiles        enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.connections     enable row level security;
alter table public.messages        enable row level security;
alter table public.collaborations  enable row level security;
alter table public.posts           enable row level security;

-- Perfiles: todos pueden verlos; cada quien edita solo el suyo.
create policy "perfiles visibles" on public.profiles for select to anon, authenticated using (true);
create policy "editar mi perfil" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Portafolio: visible para todos; cada quien maneja el suyo.
create policy "portafolio visible" on public.portfolio_items for select to anon, authenticated using (true);
create policy "agregar a mi portafolio" on public.portfolio_items for insert to authenticated
  with check (profile_id = (select auth.uid()) and image_path like (select auth.uid())::text || '/%');
create policy "borrar de mi portafolio" on public.portfolio_items for delete to authenticated
  using (profile_id = (select auth.uid()));

-- Conexiones: las aceptadas son públicas (lista de contactos); las pendientes solo las ven las dos personas.
create policy "ver conexiones" on public.connections for select to anon, authenticated
  using (status = 'accepted' or (select auth.uid()) in (requester_id, addressee_id));
create policy "pedir conexion" on public.connections for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
create policy "aceptar conexion" on public.connections for update to authenticated
  using (addressee_id = (select auth.uid())) with check (addressee_id = (select auth.uid()) and status = 'accepted');
create policy "quitar conexion" on public.connections for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Mensajes: solo los ven quien envía y quien recibe; solo se escribe a contactos.
create policy "ver mis mensajes" on public.messages for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));
create policy "enviar mensaje" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.are_connected(sender_id, recipient_id));
create policy "marcar como leido" on public.messages for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- Colaboraciones: visibles para todos; las agrega el dueño del perfil y las confirma el colaborador.
create policy "colaboraciones visibles" on public.collaborations for select to anon, authenticated using (true);
create policy "agregar colaboracion" on public.collaborations for insert to authenticated
  with check (profile_id = (select auth.uid()) and confirmed = false);
create policy "confirmar colaboracion" on public.collaborations for update to authenticated
  using (collaborator_id = (select auth.uid())) with check (collaborator_id = (select auth.uid()) and confirmed = true);
create policy "quitar colaboracion" on public.collaborations for delete to authenticated
  using ((select auth.uid()) in (profile_id, collaborator_id));

-- Publicaciones: visibles para todos; cada quien publica y borra las suyas.
create policy "publicaciones visibles" on public.posts for select to anon, authenticated using (true);
create policy "publicar" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "borrar mi publicacion" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------- Permisos de la API (columnas permitidas) ----------

grant select on public.profiles, public.portfolio_items, public.connections, public.collaborations, public.posts to anon, authenticated;
grant select on public.messages to authenticated;

grant update (name, profession, title, city, short, bio, avatar_path) on public.profiles to authenticated;
grant insert (profile_id, title, caption, image_path) on public.portfolio_items to authenticated;
grant delete on public.portfolio_items to authenticated;
grant insert (requester_id, addressee_id) on public.connections to authenticated;
grant update (status) on public.connections to authenticated;
grant delete on public.connections to authenticated;
grant insert (sender_id, recipient_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
grant insert (profile_id, collaborator_id, collaborator_name) on public.collaborations to authenticated;
grant update (confirmed) on public.collaborations to authenticated;
grant delete on public.collaborations to authenticated;
grant insert (author_id, type, body, photo_paths) on public.posts to authenticated;
grant delete on public.posts to authenticated;

-- ---------- Fotos (Storage) ----------
-- Carpeta pública "photos". Cada usuario solo sube y borra dentro de su propia carpeta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "fotos: subir en mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos: borrar de mi carpeta" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- Tiempo real (chat y solicitudes) ----------

alter publication supabase_realtime add table public.messages, public.connections, public.collaborations;
