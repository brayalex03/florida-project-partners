-- =====================================================================
-- Florida Project Partners — Mensajes sin ser contactos (como Facebook)
-- Se ejecuta una sola vez, después de 002_bolsa_de_trabajo.sql.
-- =====================================================================

-- Profesión de cualquier persona (solo para las reglas)
create or replace function private.profession_of(u uuid)
returns text language sql stable security definer set search_path = '' as $$
  select profession from public.profiles where id = u;
$$;
revoke all on function private.profession_of(uuid) from public, anon;
grant execute on function private.profession_of(uuid) to authenticated;

-- ¿Ya hay conversación? (la otra persona me escribió antes)
create or replace function private.has_written_to(sender uuid, recipient uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.messages m where m.sender_id = sender and m.recipient_id = recipient);
$$;
revoke all on function private.has_written_to(uuid, uuid) from public, anon;
grant execute on function private.has_written_to(uuid, uuid) to authenticated;

-- Quién puede escribirle a quién:
--  · contactos, siempre
--  · profesionales a profesionales, siempre (si no son contactos, llega como solicitud)
--  · a un trabajador, solo quien contrata (GC, contratista, inversionista)
--  · un trabajador solo responde: puede escribir a quien ya le escribió
drop policy "enviar mensaje" on public.messages;
create policy "enviar mensaje" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_id <> recipient_id
    and (
      private.are_connected(sender_id, recipient_id)
      or private.has_written_to(recipient_id, sender_id)
      or (
        coalesce(private.my_profession(), '') <> 'Trabajador de construcción'
        and (coalesce(private.profession_of(recipient_id), '') <> 'Trabajador de construcción' or private.is_employer())
      )
    )
  );

-- Quien te escribió puede ver tu perfil y tú el suyo
create or replace function private.can_view_profile(target uuid, target_profession text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    target = (select auth.uid())
    or (target_profession <> 'Trabajador de construcción'
        and coalesce(private.my_profession(), '') <> 'Trabajador de construcción')
    or (target_profession = 'Trabajador de construcción' and private.is_employer())
    or exists (select 1 from public.connections c
               where (c.requester_id = target and c.addressee_id = (select auth.uid()))
                  or (c.addressee_id = target and c.requester_id = (select auth.uid())))
    or exists (select 1 from public.collaborations k
               where (k.profile_id = target and k.collaborator_id = (select auth.uid()))
                  or (k.collaborator_id = target and k.profile_id = (select auth.uid())))
    or exists (select 1 from public.messages m
               where (m.sender_id = target and m.recipient_id = (select auth.uid()))
                  or (m.recipient_id = target and m.sender_id = (select auth.uid())))
    or exists (select 1 from public.job_offers o where o.employer_id = target and o.status = 'abierta')
    or exists (select 1 from public.job_applications a join public.job_offers o on o.id = a.offer_id
               where a.worker_id = target and o.employer_id = (select auth.uid()));
$$;

-- Solicitudes de mensajes: aceptar o ignorar una conversación
create table public.chat_prefs (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  partner_id  uuid not null references public.profiles(id) on delete cascade,
  state       text not null check (state in ('accepted', 'ignored')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, partner_id)
);
alter table public.chat_prefs enable row level security;
create policy "mis preferencias de chat" on public.chat_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, delete on public.chat_prefs to authenticated;
grant insert (user_id, partner_id, state), update (user_id, partner_id, state, updated_at) on public.chat_prefs to authenticated;

create index messages_recipient_sender on public.messages (recipient_id, sender_id);

-- La función contact_applicant (de 002) ya no se usa: ahora se escribe directo sin crear un contacto.
drop function if exists public.contact_applicant(uuid);
