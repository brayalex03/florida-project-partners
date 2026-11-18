-- =====================================================================
-- Florida Project Partners — Obras del trabajador
-- El GC marca "Contratar" a un interesado; la obra aparece en el perfil del trabajador.
-- Se ejecuta una sola vez, después de 004_mis_contactos.sql.
-- =====================================================================

alter table public.job_applications
  add column status text not null default 'postulado' check (status in ('postulado', 'contratado')),
  add column hired_at timestamptz;

-- Quien publicó la oferta puede contratar (o deshacerlo)
create policy "contratar postulante" on public.job_applications for update to authenticated
  using (exists (select 1 from public.job_offers o where o.id = offer_id and o.employer_id = (select auth.uid())))
  with check (exists (select 1 from public.job_offers o where o.id = offer_id and o.employer_id = (select auth.uid())));
grant update (status, hired_at) on public.job_applications to authenticated;

-- Obras de un trabajador, para su perfil:
--  · cualquiera que pueda ver su perfil ve las obras donde fue contratado
--  · el propio trabajador ve además sus postulaciones pendientes
create or replace function public.worker_obras(p_worker uuid)
returns table (
  application_id uuid, status text, applied_at timestamptz, hired_at timestamptz,
  trade text, city text, start_date date, duration text,
  employer_id uuid, employer_name text, employer_profession text
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.status, a.created_at, a.hired_at,
         o.trade, o.city, o.start_date, o.duration,
         o.employer_id, e.name, e.profession
  from public.job_applications a
  join public.job_offers o on o.id = a.offer_id
  join public.profiles e on e.id = o.employer_id
  join public.profiles w on w.id = a.worker_id
  where a.worker_id = p_worker
    and private.can_view_profile(w.id, w.profession)
    and (a.status = 'contratado' or a.worker_id = (select auth.uid()))
  order by coalesce(a.hired_at, a.created_at) desc;
$$;
revoke execute on function public.worker_obras(uuid) from public, anon;
grant execute on function public.worker_obras(uuid) to authenticated;
