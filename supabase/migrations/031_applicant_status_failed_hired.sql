-- Add 'failed' and 'hired' to applicant status for recruitment pipeline.
-- (IF NOT EXISTS supported in PostgreSQL 15+; omit if your version is older.)

ALTER TYPE applicant_status ADD VALUE 'failed';
ALTER TYPE applicant_status ADD VALUE 'hired';
