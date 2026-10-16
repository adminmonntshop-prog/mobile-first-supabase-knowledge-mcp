create extension if not exists pgcrypto;

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('mobile-ui','supabase-docs','troubleshooting','android','security','other')),
  body text not null,
  platform text not null default 'android-chrome',
  source_url text,
  source_type text not null default 'user-observation'
    check (source_type in ('official-docs','verified-screenshot','user-observation','community')),
  confidence text not null default 'unverified'
    check (confidence in ('verified','likely','unverified')),
  verified_at timestamptz,
  ui_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_articles_category_idx
  on public.knowledge_articles(category);
create index if not exists knowledge_articles_platform_idx
  on public.knowledge_articles(platform);
create index if not exists knowledge_articles_search_idx
  on public.knowledge_articles using gin (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,''))
  );

-- Enable RLS. Do not allow public writes.
alter table public.knowledge_articles enable row level security;

-- Read access for clients using the anon key. Remove this policy if knowledge is private.
drop policy if exists "knowledge articles are readable" on public.knowledge_articles;
create policy "knowledge articles are readable"
  on public.knowledge_articles for select to anon, authenticated using (true);

-- Intentionally no anon/authenticated insert, update, or delete policy.
-- Server-side privileged writes require a service-role key and should be protected.
