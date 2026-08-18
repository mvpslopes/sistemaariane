-- Presença online e histórico de acessos (painel Root)
-- Rodar no phpMyAdmin se ainda não aplicada.

ALTER TABLE users
  ADD COLUMN last_seen_at DATETIME NULL AFTER updated_at,
  ADD INDEX idx_users_last_seen (last_seen_at);

CREATE TABLE IF NOT EXISTS user_access_log (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  username        VARCHAR(100) NOT NULL,
  role            VARCHAR(20) NOT NULL,
  ip              VARCHAR(45) NULL,
  user_agent      VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ual_user_created (user_id, created_at),
  INDEX idx_ual_created (created_at),
  CONSTRAINT fk_ual_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
