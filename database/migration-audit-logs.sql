-- Log de auditoria (acessos e ações no sistema)
CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id      BIGINT UNSIGNED NULL,
  username     VARCHAR(80) NULL,
  role         VARCHAR(20) NULL,
  action       VARCHAR(40) NOT NULL,
  resource     VARCHAR(60) NOT NULL,
  resource_id  VARCHAR(80) NULL,
  summary      VARCHAR(500) NULL,
  ip           VARCHAR(64) NULL,
  user_agent   VARCHAR(500) NULL,
  success      TINYINT(1) NOT NULL DEFAULT 1,
  meta         JSON NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_resource (resource),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
