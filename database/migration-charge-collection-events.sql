-- Histórico de cobrança por parcela (contato WhatsApp, retorno do cliente, etc.)
-- Rodar no phpMyAdmin após backup.

CREATE TABLE IF NOT EXISTS charge_collection_events (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  charge_id     BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NULL,
  user_name     VARCHAR(120) NULL,
  note          TEXT NOT NULL,
  outcome       ENUM('sent','answered','no_answer','promised','paid','other') NOT NULL DEFAULT 'other',
  promised_date DATE NULL,
  channel       ENUM('whatsapp','phone','email','other') NOT NULL DEFAULT 'whatsapp',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cce_charge (charge_id),
  INDEX idx_cce_created (created_at),
  CONSTRAINT fk_cce_charge FOREIGN KEY (charge_id) REFERENCES charges(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
