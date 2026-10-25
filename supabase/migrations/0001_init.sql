-- PULSE – Datenbankschema (PostgreSQL / Supabase)
-- Grundsätze: Row-Level Security auf JEDER Tabelle, keine öffentlichen Gesundheitsdaten,
-- Token ausschließlich verschlüsselt und nur per Service-Role lesbar, Löschung per ON DELETE CASCADE.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profil & Einwilligungen
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Geburtsjahr statt Geburtsdatum (Datensparsamkeit); nur auf Wunsch der Person
  birth_year smallint check (birth_year between 1900 and 2100),
  sleep_target_min smallint check (sleep_target_min between 240 and 720),
  hr_max smallint check (hr_max between 120 and 230),
  food_lens text check (food_lens in ('peat', 'primal', 'custom')),
  custom_lens_rules jsonb not null default '{"prefer":[],"avoid":[]}',
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only-Protokoll: der jeweils neueste Eintrag je Zweck gilt.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('health_data_processing', 'google_health_import', 'ai_coach', 'ai_food_analysis')),
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);
create index consents_user_purpose_idx on public.consents (user_id, purpose, created_at desc);

-- ---------------------------------------------------------------------------
-- Wearable-Verbindungen & Geheimnisse
-- ---------------------------------------------------------------------------
create table public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'google_health' check (provider in ('google_health')),
  status text not null default 'connected' check (status in ('connected', 'needs_reauth', 'revoked', 'error')),
  granted_scopes text[] not null default '{}',
  device_hint text,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_detail jsonb,           -- Status je Datentyp (ok / no_data / unsupported_device / missing_scope / error)
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Tokens: RLS an, KEINE Policy → nur Service-Role (Edge Functions) kann zugreifen.
create table public.wearable_secrets (
  connection_id uuid primary key references public.wearable_connections (id) on delete cascade,
  enc_refresh_token text not null,   -- AES-256-GCM, Schlüssel liegt nur als Edge-Function-Secret vor
  enc_access_token text,
  access_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gesundheitsdaten
-- ---------------------------------------------------------------------------
create table public.daily_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  resting_hr numeric(5, 1) check (resting_hr between 25 and 140),
  hrv_ms numeric(6, 1) check (hrv_ms between 5 and 400),
  resp_rate numeric(4, 1) check (resp_rate between 5 and 45),
  spo2 numeric(4, 1) check (spo2 between 70 and 100),
  skin_temp_dev_c numeric(4, 2) check (skin_temp_dev_c between -5 and 5),
  steps integer check (steps between 0 and 100000),
  active_minutes integer check (active_minutes between 0 and 1440),
  azm integer check (azm between 0 and 1440),
  vo2max numeric(4, 1) check (vo2max between 10 and 90),
  source text not null default 'google_health',
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.sleep_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null,
  date date not null,                -- Aufwach-Tag
  start_local text not null,         -- lokale Uhrzeit ohne Offset
  end_local text not null,
  in_bed_min integer not null check (in_bed_min between 1 and 1440),
  asleep_min integer check (asleep_min between 0 and 1440),
  asleep_is_estimate boolean not null default false,
  awake_min integer, light_min integer, deep_min integer, rem_min integer,  -- NULL, wenn die Quelle keine Phasen liefert
  source text not null default 'google_health',
  updated_at timestamptz not null default now(),
  primary key (user_id, provider_id)
);
create index sleep_sessions_user_date_idx on public.sleep_sessions (user_id, date desc);

create table public.workouts (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  source text not null check (source in ('device', 'manual')),
  type text not null,
  start_local text not null,
  duration_min integer not null check (duration_min between 1 and 1440),
  avg_hr integer, max_hr integer,
  zone_min integer[] check (zone_min is null or array_length(zone_min, 1) = 5),
  rpe smallint check (rpe between 1 and 10),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index workouts_user_start_idx on public.workouts (user_id, start_local desc);

-- App-berechnete Werte (reproduzierbar aus den Rohdaten; model_version dokumentiert die Formel).
create table public.daily_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  recovery numeric(5, 1) check (recovery between 0 and 100),
  sleep numeric(5, 1) check (sleep between 0 and 100),
  strain numeric(4, 1) check (strain between 0 and 21),
  vitality numeric(5, 1) check (vitality between 0 and 100),
  model_version text not null,
  computed_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.personal_baselines (
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null,
  as_of date not null,
  center numeric not null,
  spread numeric not null,
  n integer not null,
  primary key (user_id, metric, as_of)
);

-- ---------------------------------------------------------------------------
-- Selbsteinschätzung, Gewohnheiten, Ernährung, KI
-- ---------------------------------------------------------------------------
create table public.checkins (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  stress smallint check (stress between 1 and 5),
  energy smallint check (energy between 1 and 5),
  mood smallint check (mood between 1 and 5),
  reflection text check (char_length(reflection) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  kind text not null default 'custom' check (kind in ('sleep_regularity', 'movement', 'recovery', 'breaks', 'training', 'custom')),
  target_per_week smallint not null default 5 check (target_per_week between 1 and 7),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.habit_logs (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  done boolean not null default true,
  primary key (habit_id, date)
);

create table public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  ml integer not null check (ml between 1 and 3000),
  created_at timestamptz not null default now()
);
create index hydration_user_date_idx on public.hydration_logs (user_id, date);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  time_local text check (time_local is null or time_local ~ '^[0-2][0-9]:[0-5][0-9]$'),
  note text check (char_length(note) <= 500),
  rating_score numeric(5, 1) check (rating_score between 0 and 100),
  rating_version text,
  created_at timestamptz not null default now()
);
create index meals_user_date_idx on public.meals (user_id, date);

-- Fotos werden NICHT gespeichert; nur das bestätigte/bearbeitete Ergebnis.
create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  grams numeric(7, 1) not null check (grams > 0 and grams <= 5000),
  state text not null default 'n/a' check (state in ('raw', 'cooked', 'n/a')),
  processing text not null default 'whole' check (processing in ('whole', 'processed', 'ultra')),
  tags text[] not null default '{}',
  source text not null check (source in ('ai', 'database', 'manual')),
  confidence numeric(3, 2) check (confidence between 0 and 1),
  food_id text,
  nutrients_estimated boolean not null default false,
  per100g jsonb not null,   -- Nährwerte pro 100 g (siehe src/core/nutrition.ts)
  created_at timestamptz not null default now()
);
create index meal_items_meal_idx on public.meal_items (meal_id);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ai', 'rule_based')),
  question text,
  answer text not null,
  model text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','consents','wearable_connections','wearable_secrets','daily_metrics','sleep_sessions','workouts',
    'daily_scores','personal_baselines','checkins','habits','habit_logs','hydration_logs','meals','meal_items','ai_insights'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;

  -- Volle Kontrolle der eigenen Zeilen (Eingaben der Person selbst)
  foreach t in array array['profiles','daily_scores','personal_baselines','checkins','habits','habit_logs','hydration_logs','meals','meal_items','ai_insights'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner_all', t);
  end loop;

  -- Vom Gerät importierte Daten: nur lesen (geschrieben von Edge Functions mit Service-Role)
  foreach t in array array['daily_metrics','sleep_sessions','wearable_connections'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_owner_select', t);
  end loop;
end $$;

-- Einwilligungen: lesen + anhängen, niemals ändern/löschen (Nachweisbarkeit)
create policy consents_owner_select on public.consents for select to authenticated using (user_id = (select auth.uid()));
create policy consents_owner_insert on public.consents for insert to authenticated with check (user_id = (select auth.uid()));

-- Trainings: eigene manuelle Einträge frei bearbeitbar; Geräte-Trainings nur lesbar.
create policy workouts_owner_select on public.workouts for select to authenticated using (user_id = (select auth.uid()));
create policy workouts_owner_insert_manual on public.workouts for insert to authenticated with check (user_id = (select auth.uid()) and source = 'manual');
create policy workouts_owner_update_manual on public.workouts for update to authenticated
  using (user_id = (select auth.uid()) and source = 'manual') with check (user_id = (select auth.uid()) and source = 'manual');
create policy workouts_owner_delete_manual on public.workouts for delete to authenticated using (user_id = (select auth.uid()) and source = 'manual');

-- wearable_secrets: bewusst KEINE Policy → für authentifizierte Clients vollständig gesperrt.

-- Anon-Rolle: keinerlei Zugriff
revoke all on all tables in schema public from anon;
revoke all on public.wearable_secrets from authenticated;

-- ---------------------------------------------------------------------------
-- Komfort: Profil beim Registrieren anlegen, updated_at pflegen
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger checkins_touch before update on public.checkins for each row execute function public.touch_updated_at();
