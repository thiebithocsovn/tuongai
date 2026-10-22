-- Tường học tập AI: bài tập tương tự nộp qua liên kết lớp, AI chấm sơ bộ,
-- giáo viên chốt điểm / khóa sổ. Bài của các học sinh khác không công khai.
create table if not exists public.similar_attempts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  exercise_key text not null,
  exercise_question text not null default '',
  student_token text not null,
  student_name text not null,
  response text not null,
  image_path text not null default '',
  ai_score numeric(5,2),
  ai_note text not null default '',
  ai_model text not null default '',
  teacher_score numeric(5,2),
  teacher_note text not null default '',
  reviewed_by uuid,
  locked_at timestamptz,
  submitted_at timestamptz not null default now(),
  constraint similar_attempts_unique unique(post_id,exercise_key,student_token),
  constraint similar_attempts_score_bounds check (
    (ai_score is null or ai_score between 0 and 10)
    and (teacher_score is null or teacher_score between 0 and 10)
  ),
  constraint similar_attempts_token_length check(length(student_token) between 16 and 80),
  constraint similar_attempts_response_length check(length(response) between 1 and 8000)
);
alter table public.similar_attempts add column if not exists exercise_question text not null default '';
alter table public.similar_attempts add column if not exists image_path text not null default '';
create index if not exists similar_attempts_post_idx on public.similar_attempts(post_id,submitted_at desc);
create index if not exists similar_attempts_board_idx on public.similar_attempts(board_id,locked_at);
create index if not exists similar_attempts_student_idx on public.similar_attempts(student_token,submitted_at desc);
alter table public.similar_attempts enable row level security;
revoke all on public.similar_attempts from anon, authenticated;
-- Truy cập qua Edge Function service role. Không tạo policy SELECT công khai
-- cho điểm, nhận xét, ảnh riêng hay mã thiết bị học sinh.
