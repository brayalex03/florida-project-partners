-- =====================================================================
-- Florida Project Partners — Mis contactos (agenda privada)
-- Cada persona guarda a quien quiera, sin que la otra acepte ni lo vea.
-- Se ejecuta una sola vez, después de 003_mensajes_sin_contacto.sql.
-- =====================================================================

create table public.contacts (
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  contact_id  uuid not null references public.profiles(id) on delete cascade,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
alter table public.contacts enable row level security;

-- Solo el dueño ve, agrega, edita y quita sus contactos.
-- Solo puede guardar a alguien cuyo perfil puede ver.
create policy "ver mis contactos" on public.contacts for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "agregar contacto" on public.contacts for insert to authenticated
  with check (owner_id = (select auth.uid())
              and private.can_view_profile(contact_id, private.profession_of(contact_id)));
create policy "editar nota" on public.contacts for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "quitar contacto" on public.contacts for delete to authenticated
  using (owner_id = (select auth.uid()));

grant select, delete on public.contacts to authenticated;
grant insert (owner_id, contact_id, note) on public.contacts to authenticated;
grant update (note) on public.contacts to authenticated;

-- Las conexiones que ya existían pasan a ser contactos (aceptadas: para los dos; pendientes: para quien la envió)
insert into public.contacts (owner_id, contact_id)
select requester_id, addressee_id from public.connections
union
select addressee_id, requester_id from public.connections where status = 'accepted'
on conflict do nothing;

-- Mensajes: ser contacto ya no da permiso para escribir.
--  · profesionales a profesionales, siempre (si nunca han hablado llega como solicitud)
--  · a un trabajador, solo quien contrata (GC, contratista, inversionista)
--  · un trabajador solo responde a quien ya le escribió
drop policy "enviar mensaje" on public.messages;
create policy "enviar mensaje" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_id <> recipient_id
    and (
      private.has_written_to(recipient_id, sender_id)
      or (
        coalesce(private.my_profession(), '') <> 'Trabajador de construcción'
        and (coalesce(private.profession_of(recipient_id), '') <> 'Trabajador de construcción' or private.is_employer())
      )
    )
  );

-- Ya no se crean conexiones nuevas desde la página (se mantienen como historial)
drop policy "pedir conexion" on public.connections;
