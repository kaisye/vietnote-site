-- The survey now goes to every user and asks for their email, so the team can follow up.
alter table public.feedback_responses
  add column if not exists email text
    check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));
