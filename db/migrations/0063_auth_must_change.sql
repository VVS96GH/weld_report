-- A password set by an administrator (new user, reset, first admin) must be changed at the first
-- sign-in (owner, 2026-10-28).
ALTER TABLE app_user ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
