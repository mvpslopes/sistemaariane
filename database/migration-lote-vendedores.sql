-- Vários vendedores por lote de leilão
CREATE TABLE IF NOT EXISTS auction_lot_sellers (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lot_id      BIGINT UNSIGNED NOT NULL,
  client_id   BIGINT UNSIGNED NOT NULL,
  share_pct   DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  is_primary  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_lot_seller (lot_id, client_id),
  INDEX idx_als_lot (lot_id),
  CONSTRAINT fk_als_lot FOREIGN KEY (lot_id) REFERENCES auction_lots(id) ON DELETE CASCADE,
  CONSTRAINT fk_als_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill a partir do vendedor único já cadastrado no lote
INSERT IGNORE INTO auction_lot_sellers (lot_id, client_id, share_pct, is_primary)
SELECT id, seller_id, 100.00, 1
FROM auction_lots
WHERE seller_id IS NOT NULL;
