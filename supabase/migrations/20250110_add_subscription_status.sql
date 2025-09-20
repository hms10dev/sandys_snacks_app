-- Extend payments_manual with subscription status flags
alter table payments_manual
  add column if not exists paused boolean not null default false,
  add column if not exists paused_at timestamptz,
  add column if not exists canceled boolean not null default false,
  add column if not exists canceled_at timestamptz;

create index if not exists payments_manual_paused_idx on payments_manual (paused);
create index if not exists payments_manual_canceled_idx on payments_manual (canceled);
