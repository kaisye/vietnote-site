create table if not exists public.feedback_responses (
  id uuid primary key default gen_random_uuid(),

  rating smallint not null
    check (rating between 1 and 5),

  use_case text[] not null default '{}',
  occupation text,

  most_useful text not null
    check (char_length(trim(most_useful)) between 1 and 800),

  friction text not null default ''
    check (char_length(friction) <= 1000),

  feature_request text not null default ''
    check (char_length(feature_request) <= 1000),

  nps smallint not null
    check (nps between 0 and 10),

  source text not null default 'first_100',
  created_at timestamptz not null default now()
);

alter table public.feedback_responses enable row level security;

revoke all privileges
on table public.feedback_responses
from anon, authenticated;

grant all privileges
on table public.feedback_responses
to service_role;
