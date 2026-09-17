-- answer_timing (20260914154000) already adds this column; guard against the
-- duplicate so migrations stay idempotent when replayed on a fresh database.
ALTER TABLE "interview_answers" ADD COLUMN IF NOT EXISTS "time_taken_seconds" integer;