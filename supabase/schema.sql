create table if not exists words (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null default 'word',
  word text not null,
  phonetic text not null default '',
  part_of_speech text not null default '',
  meaning text not null default '',
  unit text not null default '',
  tags text[] not null default '{}',
  notes text not null default '',
  stages text[] not null default '{}',
  source text not null default 'custom',
  upload_batch_id text not null default '',
  upload_batch_name text not null default '',
  stats jsonb not null default '{"wrongCount":0,"correctCount":0,"fieldWrongCounts":{},"consecutiveCorrect":0}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists dictation_rooms (
  id text primary key,
  parent_token text not null,
  child_token text not null,
  status text not null default 'active',
  total_count integer not null,
  mistake_ratio integer not null,
  word_source text not null default 'all',
  stage text not null default '',
  question_mode text not null default 'mixed',
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists dictation_answers (
  room_id text not null references dictation_rooms(id) on delete cascade,
  question_id text not null,
  answer jsonb not null,
  verdict jsonb not null,
  duration_seconds integer,
  submitted_at timestamptz not null default now(),
  primary key (room_id, question_id)
);

alter table dictation_answers add column if not exists duration_seconds integer;

create index if not exists words_created_at_idx on words (created_at desc);
create index if not exists words_source_idx on words (source);
create index if not exists words_upload_batch_id_idx on words (upload_batch_id);
create index if not exists dictation_answers_room_id_idx on dictation_answers (room_id);
