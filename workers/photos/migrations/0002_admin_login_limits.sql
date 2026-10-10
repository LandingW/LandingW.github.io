CREATE TABLE admin_login_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX admin_login_limits_expiry ON admin_login_limits(expires_at);
