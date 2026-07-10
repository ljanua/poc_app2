-- Feature 020: LLM video observation and error text on clips.comments

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS comments TEXT;
