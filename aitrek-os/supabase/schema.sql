-- AITREK OS — Supabase (PostgreSQL) schema
-- Supabase ダッシュボードの SQL Editor でこのファイルを丸ごと実行してください。
-- カラム名は src/lib/types.ts と一致させています。

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tables

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null default '',
  email text not null unique,
  role text not null default 'viewer'
    check (role in ('owner','admin','sales','trade_ops','finance','marketing','viewer','ai_agent')),
  active boolean not null default true
);

create table if not exists producers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null default '',
  company_name text not null,
  brand_name text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  prefecture text not null default '',
  website text not null default '',
  categories jsonb not null default '[]',
  main_products text not null default '',
  sku_count integer,
  wholesale_price text not null default '',
  moq text not null default '',
  capacity text not null default '',
  inventory text not null default '',
  shelf_life text not null default '',
  storage_temp text not null default '',
  export_experience text not null default '',
  available_countries jsonb not null default '[]',
  certifications jsonb not null default '[]',
  image_url text not null default '',
  docs_url text not null default '',
  contract_status text not null default '未契約',
  commission_rate numeric,
  last_contact_at text not null default '',
  next_action text not null default '',
  next_action_date text not null default '',
  notes text not null default ''
);

create table if not exists buyers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null default '',
  country text not null default '',
  city text not null default '',
  company_name text not null,
  business_type text not null default '',
  website text not null default '',
  contact_name text not null default '',
  position text not null default '',
  email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  linkedin text not null default '',
  desired_products text not null default '',
  price_range text not null default '',
  desired_moq text not null default '',
  incoterms text not null default '',
  payment_terms text not null default '',
  import_history text not null default '',
  status text not null default 'Lead',
  currency text not null default 'USD',
  last_contact_at text not null default '',
  next_contact_at text not null default '',
  notes text not null default ''
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null default '',
  producer_id uuid references producers(id) on delete set null,
  name text not null,
  name_en text not null default '',
  category text not null default '',
  sku text not null default '',
  jan text not null default '',
  hs_code text not null default '',
  ingredients text not null default '',
  net_content text not null default '',
  cost_price numeric,
  domestic_wholesale_price numeric,
  export_price numeric,
  moq numeric,
  case_qty numeric,
  weight_kg numeric,
  size text not null default '',
  shelf_life text not null default '',
  storage text not null default '',
  certifications jsonb not null default '[]',
  export_restrictions text not null default '',
  target_countries jsonb not null default '[]',
  image_url text not null default '',
  description_en text not null default '',
  description_zh text not null default '',
  description_ko text not null default '',
  status text not null default '候補'
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null default '',
  title text not null default '',
  buyer_id uuid references buyers(id) on delete set null,
  producer_id uuid references producers(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  country text not null default '',
  quantity numeric not null default 0,
  unit text not null default 'pcs',
  currency text not null default 'USD',
  incoterm text not null default 'FOB',
  payment_terms text not null default '',
  expected_revenue numeric not null default 0,
  expected_profit numeric not null default 0,
  probability numeric not null default 0,
  stage text not null default 'lead',
  next_action text not null default '',
  deadline text not null default '',
  owner_id uuid references members(id) on delete set null,
  cost jsonb not null default '{}',
  price_approved boolean not null default false,
  contract_approved boolean not null default false,
  notes text not null default ''
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  deal_id uuid references deals(id) on delete cascade,
  entity_type text not null default 'system',
  entity_id uuid,
  type text not null default 'note',
  message text not null default '',
  actor text not null default ''
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  deal_id uuid references deals(id) on delete cascade,
  kind text not null default 'general',
  group_name text not null default '',
  assignee_id uuid references members(id) on delete set null,
  due_date text not null default '',
  status text not null default 'todo',
  note text not null default '',
  attachments jsonb not null default '[]',
  sort_order integer not null default 0,
  auto_key text not null default ''
);

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null default '',
  deal_id uuid references deals(id) on delete set null,
  buyer_id uuid references buyers(id) on delete set null,
  issue_date text not null default '',
  valid_until text not null default '',
  currency text not null default 'USD',
  incoterm text not null default 'FOB',
  port text not null default '',
  payment_terms text not null default '',
  lead_time text not null default '',
  items jsonb not null default '[]',
  notes text not null default '',
  status text not null default 'draft'
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null default '',
  type text not null,
  deal_id uuid references deals(id) on delete set null,
  title text not null default '',
  issue_date text not null default '',
  currency text not null default 'USD',
  incoterm text not null default 'FOB',
  items jsonb not null default '[]',
  fields jsonb not null default '{}',
  status text not null default 'draft',
  file_url text not null default ''
);

create table if not exists finance (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deal_id uuid not null references deals(id) on delete cascade,
  invoice_no text not null default '',
  currency text not null default 'USD',
  exchange_rate numeric not null default 1,
  revenue numeric not null default 0,
  cost numeric not null default 0,
  invoice_amount numeric not null default 0,
  invoice_date text not null default '',
  payment_due text not null default '',
  paid_date text not null default '',
  paid_amount numeric not null default 0,
  status text not null default 'unbilled',
  producer_payment numeric not null default 0,
  logistics_payment numeric not null default 0,
  notes text not null default ''
);

create table if not exists app_settings (
  id integer primary key default 1 check (id = 1),
  data jsonb not null default '{}'
);

create index if not exists tasks_deal_idx on tasks(deal_id);
create index if not exists activities_deal_idx on activities(deal_id);
create index if not exists deals_stage_idx on deals(stage);

-- ---------------------------------------------------------------- roles

-- ログイン中ユーザーの Role（members.email と auth.users.email を突き合わせる）
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from members where lower(email) = lower(auth.jwt() ->> 'email') and active limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.app_role() in ('owner','admin'), false) $$;

create or replace function public.can_write() returns boolean
language sql stable as $$ select coalesce(public.app_role() in ('owner','admin','sales','trade_ops','finance','marketing','ai_agent'), false) $$;

create or replace function public.can_delete() returns boolean
language sql stable as $$ select coalesce(public.app_role() in ('owner','admin','sales','trade_ops'), false) $$;

-- ---------------------------------------------------------------- RLS
-- 画面側でも権限を制御していますが、重要操作（削除・ユーザー管理・設定）は DB 側でも制限します。

do $$
declare t text;
begin
  foreach t in array array['producers','buyers','products','deals','activities','tasks','quotations','documents','finance'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%1$s_select" on %1$I', t);
    execute format('drop policy if exists "%1$s_insert" on %1$I', t);
    execute format('drop policy if exists "%1$s_update" on %1$I', t);
    execute format('drop policy if exists "%1$s_delete" on %1$I', t);
    execute format('create policy "%1$s_select" on %1$I for select to authenticated using (public.app_role() is not null)', t);
    execute format('create policy "%1$s_insert" on %1$I for insert to authenticated with check (public.can_write())', t);
    execute format('create policy "%1$s_update" on %1$I for update to authenticated using (public.can_write())', t);
  end loop;
end $$;

-- Buyer / Producer の削除は Owner / Admin のみ
create policy "producers_delete" on producers for delete to authenticated using (public.is_admin());
create policy "buyers_delete" on buyers for delete to authenticated using (public.is_admin());
create policy "products_delete" on products for delete to authenticated using (public.can_delete());
create policy "deals_delete" on deals for delete to authenticated using (public.can_delete());
create policy "tasks_delete" on tasks for delete to authenticated using (public.can_delete());
create policy "quotations_delete" on quotations for delete to authenticated using (public.can_delete());
create policy "documents_delete" on documents for delete to authenticated using (public.can_delete());
create policy "activities_delete" on activities for delete to authenticated using (public.is_admin());
create policy "finance_delete" on finance for delete to authenticated using (public.is_admin());

-- members：閲覧は全メンバー、追加・変更は Owner / Admin。
-- 最初の 1 人だけは自分自身を Owner として登録できる（初期セットアップ）。
alter table members enable row level security;
drop policy if exists "members_select" on members;
drop policy if exists "members_insert" on members;
drop policy if exists "members_update" on members;
drop policy if exists "members_delete" on members;
create policy "members_select" on members for select to authenticated using (true);
create policy "members_insert" on members for insert to authenticated with check (
  public.is_admin()
  or (not exists (select 1 from members) and lower(email) = lower(auth.jwt() ->> 'email') and role = 'owner')
  or (lower(email) = lower(auth.jwt() ->> 'email') and role = 'viewer')
);
create policy "members_update" on members for update to authenticated using (public.is_admin());
create policy "members_delete" on members for delete to authenticated using (public.is_admin());

alter table app_settings enable row level security;
drop policy if exists "settings_select" on app_settings;
drop policy if exists "settings_write" on app_settings;
create policy "settings_select" on app_settings for select to authenticated using (true);
create policy "settings_write" on app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

drop policy if exists "attachments_read" on storage.objects;
drop policy if exists "attachments_write" on storage.objects;
create policy "attachments_read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.app_role() is not null);
create policy "attachments_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_write());
