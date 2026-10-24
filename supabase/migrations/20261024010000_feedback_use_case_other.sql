-- What people type after choosing "Mục đích khác".
alter table public.feedback_responses
  add column if not exists use_case_other text not null default ''
    check (char_length(use_case_other) <= 200);
