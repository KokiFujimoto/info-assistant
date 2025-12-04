-- Create article_feedback table
create table if not exists article_feedback (
  id uuid default gen_random_uuid() primary key,
  article_id bigint references articles(id) on delete cascade,
  is_interested boolean not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies if needed (assuming public access for now or handled by API)
alter table article_feedback enable row level security;

create policy "Enable insert for anon users" on article_feedback for insert with check (true);
create policy "Enable select for anon users" on article_feedback for select using (true);
