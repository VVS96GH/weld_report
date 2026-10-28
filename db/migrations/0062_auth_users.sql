-- Sign-in by e-mail and password (owner, 2026-10-28): users with a role and their sessions.
-- The password is kept only as a salted scrypt hash; a session only as the SHA-256 of its token.
CREATE TABLE app_user (
  id             bigserial   PRIMARY KEY,
  email          text        NOT NULL UNIQUE CHECK (email = lower(email)),
  name           text        NOT NULL DEFAULT '',
  role           text        NOT NULL CHECK (role IN ('admin', 'user')),
  password_hash  text        NOT NULL,
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

CREATE TABLE user_session (
  id          bigserial   PRIMARY KEY,
  token_hash  text        NOT NULL UNIQUE,
  user_id     bigint      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX user_session_user_id_idx ON user_session (user_id);
