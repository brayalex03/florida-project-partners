-- =====================================================================
-- Florida Project Partners — Bolsa de trabajo
-- Trabajadores de construcción, ofertas de trabajo y postulaciones.
-- Se ejecuta una sola vez, después de schema.sql.
-- =====================================================================

-- ---------- Perfil: trabajador, oficio y disponibilidad ----------

alter table public.profiles drop constraint profiles_profession_check;
alter table public.profiles add constraint profiles_profession_check check (profession in (
  'General Contractor','Contratista','Prestamista','Realtor','Arquitecto','Inversionista','Proveedor','Trabajador de construcción'));

alter table public.profiles
  add column trade text check (trade in (
    'Drywall','Pintura','Carpintería','Concreto','Techos','Plomería','Electricidad',
    'Pisos y azulejos','Demolición','Landscaping','Ayudante general','Otro')),
  add column available boolean not null default false,
  add column available_since timestamptz;

grant update (trade, available, available_since) on public.profiles to authenticated;

-- Registro: acepta trabajadores y su oficio
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p text := new.raw_user_meta_data->>'profession';
  t text := new.raw_user_meta_data->>'trade';
begin
  insert into public.profiles (id, name, profession, title, city, short, bio, trade)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)), 80),
    case when p in ('General Contractor','Contratista','Prestamista','Realtor','Arquitecto','Inversionista','Proveedor','Trabajador de construcción') then p else 'Contratista' end,
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'title', '')), 60), ''),
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'city'), ''), 'Florida'), 60),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'short', '')), 160), ''),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'short', '')), 1500), ''),
    case when p = 'Trabajador de construcción' and t in ('Drywall','Pintura','Carpintería','Concreto','Techos','Plomería','Electricidad',
      'Pisos y azulejos','Demolición','Landscaping','Ayudante general','Otro') then t
      when p = 'Trabajador de construcción' then 'Ayudante general' end
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- Ofertas de trabajo y postulaciones ----------

create table public.job_offers (
  id           uuid primary key default gen_random_uuid(),
  employer_id  uuid not null references public.profiles(id) on delete cascade,
  trade        text not null check (trade in (
    'Drywall','Pintura','Carpintería','Concreto','Techos','Plomería','Electricidad',
    'Pisos y azulejos','Demolición','Landscaping','Ayudante general','Otro')),
  city         text not null check (char_length(city) between 1 and 60),
  people       int  not null default 1 check (people between 1 and 50),
  start_date   date,
  duration     text check (char_length(duration) <= 60),
  description  text check (char_length(description) <= 1000),
  status       text not null default 'abierta' check (status in ('abierta','cubierta')),
  created_at   timestamptz not null default now()
);
create index job_offers_open on public.job_offers (status, created_at desc);
create index job_offers_employer on public.job_offers (employer_id);

create table public.job_applications (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references public.job_offers(id) on delete cascade,
  worker_id   uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (offer_id, worker_id)
);
create index job_applications_worker on public.job_applications (worker_id);

-- ---------- Funciones internas (no expuestas en la API) ----------

create or replace function private.my_profession()
returns text language sql stable security definer set search_path = '' as $$
  select profession from public.profiles where id = (select auth.uid());
$$;

create or replace function private.is_employer()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select profession in ('General Contractor','Contratista','Inversionista')
                   from public.profiles where id = (select auth.uid())), false);
$$;

-- ¿Puede quien está mirando ver este perfil?
create or replace function private.can_view_profile(target uuid, target_profession text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    target = (select auth.uid())
    -- Profesionales: los ven visitantes y profesionales
    or (target_profession <> 'Trabajador de construcción'
        and coalesce(private.my_profession(), '') <> 'Trabajador de construcción')
    -- Trabajadores: los ven quienes contratan (GC, contratista, inversionista)
    or (target_profession = 'Trabajador de construcción' and private.is_employer())
    -- Personas con relación directa (conexión, colaboración, oferta o postulación)
    or exists (select 1 from public.connections c
               where (c.requester_id = target and c.addressee_id = (select auth.uid()))
                  or (c.addressee_id = target and c.requester_id = (select auth.uid())))
    or exists (select 1 from public.collaborations k
               where (k.profile_id = target and k.collaborator_id = (select auth.uid()))
                  or (k.collaborator_id = target and k.profile_id = (select auth.uid())))
    -- Un trabajador ve a quien publicó ofertas de trabajo abiertas
    or exists (select 1 from public.job_offers o where o.employer_id = target and o.status = 'abierta')
    -- Quien publicó una oferta ve a los trabajadores que se postularon
    or exists (select 1 from public.job_applications a join public.job_offers o on o.id = a.offer_id
               where a.worker_id = target and o.employer_id = (select auth.uid()));
$$;

revoke all on function private.my_profession(), private.is_employer(), private.can_view_profile(uuid, text) from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.my_profession(), private.is_employer(), private.can_view_profile(uuid, text) to anon, authenticated;

-- ---------- Reglas de seguridad ----------

-- Perfiles: según quién mira
drop policy "perfiles visibles" on public.profiles;
create policy "perfiles visibles" on public.profiles for select to anon, authenticated
  using (private.can_view_profile(id, profession));

-- Publicaciones: los trabajadores no ven ni crean publicaciones generales
drop policy "publicaciones visibles" on public.posts;
create policy "publicaciones visibles" on public.posts for select to anon, authenticated
  using (coalesce(private.my_profession(), '') <> 'Trabajador de construcción' or author_id = (select auth.uid()));
drop policy "publicar" on public.posts;
create policy "publicar" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and coalesce(private.my_profession(), '') <> 'Trabajador de construcción');

-- Conexiones: los trabajadores no envían solicitudes (las reciben de quien contrata)
drop policy "pedir conexion" on public.connections;
create policy "pedir conexion" on public.connections for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending'
              and coalesce(private.my_profession(), '') <> 'Trabajador de construcción');

alter table public.job_offers enable row level security;
alter table public.job_applications enable row level security;

-- Ofertas: las abiertas las ve todo el mundo; las cerradas solo quien las publicó
create policy "ver ofertas" on public.job_offers for select to anon, authenticated
  using (status = 'abierta' or employer_id = (select auth.uid()));
create policy "publicar oferta" on public.job_offers for insert to authenticated
  with check (employer_id = (select auth.uid()) and private.is_employer());
create policy "editar mi oferta" on public.job_offers for update to authenticated
  using (employer_id = (select auth.uid())) with check (employer_id = (select auth.uid()));
create policy "borrar mi oferta" on public.job_offers for delete to authenticated
  using (employer_id = (select auth.uid()));

-- Postulaciones: las ve el trabajador y quien publicó la oferta
create policy "ver postulaciones" on public.job_applications for select to authenticated
  using (worker_id = (select auth.uid())
         or exists (select 1 from public.job_offers o where o.id = offer_id and o.employer_id = (select auth.uid())));
create policy "postularme" on public.job_applications for insert to authenticated
  with check (worker_id = (select auth.uid())
              and private.my_profession() = 'Trabajador de construcción'
              and exists (select 1 from public.job_offers o where o.id = offer_id and o.status = 'abierta'));
create policy "retirar postulacion" on public.job_applications for delete to authenticated
  using (worker_id = (select auth.uid()));

grant select on public.job_offers to anon, authenticated;
grant insert (employer_id, trade, city, people, start_date, duration, description) on public.job_offers to authenticated;
grant update (trade, city, people, start_date, duration, description, status) on public.job_offers to authenticated;
grant delete on public.job_offers to authenticated;
grant select on public.job_applications to authenticated;
grant insert (offer_id, worker_id) on public.job_applications to authenticated;
grant delete on public.job_applications to authenticated;

-- ---------- Contactar a un trabajador que se postuló ----------
-- Quien publicó la oferta abre el chat de inmediato (conexión aceptada).

create function public.contact_applicant(p_application uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  w uuid; e uuid;
begin
  select a.worker_id, o.employer_id into w, e
  from public.job_applications a join public.job_offers o on o.id = a.offer_id
  where a.id = p_application;
  if e is null or e <> (select auth.uid()) then
    raise exception 'No autorizado';
  end if;
  insert into public.connections (requester_id, addressee_id, status)
  values (e, w, 'accepted')
  on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  do update set status = 'accepted';
end;
$$;
revoke execute on function public.contact_applicant(uuid) from public, anon;
grant execute on function public.contact_applicant(uuid) to authenticated;

-- ---------- Tiempo real: nuevos interesados ----------
alter publication supabase_realtime add table public.job_applications;
