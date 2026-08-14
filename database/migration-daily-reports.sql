-- Registro diário de atendimento (equipe operacional)
-- Rodar no phpMyAdmin se ainda não aplicada.

CREATE TABLE IF NOT EXISTS daily_reports (
  id                          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id                     BIGINT UNSIGNED NULL,
  data                        DATE NOT NULL,
  colaboradora                VARCHAR(120) NOT NULL,
  num_atendimentos            VARCHAR(50) NOT NULL,
  todos_clientes_respondidos  TINYINT(1) NOT NULL DEFAULT 1,
  clientes_pendentes          TEXT NULL,
  cliente_irritado            TINYINT(1) NOT NULL DEFAULT 0,
  cobranca_indevida           TINYINT(1) NOT NULL DEFAULT 0,
  questionamento_financeiro   TINYINT(1) NOT NULL DEFAULT 0,
  contestacao_regras          TINYINT(1) NOT NULL DEFAULT 0,
  escalado_gestao             TINYINT(1) NOT NULL DEFAULT 0,
  nenhuma_critica             TINYINT(1) NOT NULL DEFAULT 1,
  suporte_gestao              TINYINT(1) NOT NULL DEFAULT 0,
  suporte_colegas             TINYINT(1) NOT NULL DEFAULT 0,
  motivo_suporte              TEXT NULL,
  autoavaliacao               VARCHAR(50) NOT NULL,
  compromissos_amanha         TEXT NULL,
  declaracao                  TINYINT(1) NOT NULL DEFAULT 0,
  created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_daily_report_user_date (user_id, data),
  INDEX idx_daily_report_data (data),
  INDEX idx_daily_report_colaboradora (colaboradora),
  CONSTRAINT fk_daily_report_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
