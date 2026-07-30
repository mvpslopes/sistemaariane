-- =============================================================================
-- Migration: papel Testemunha em clients
-- Rode uma vez no phpMyAdmin (banco u179630068_mvp_ariane)
-- =============================================================================

ALTER TABLE clients
  ADD COLUMN is_witness TINYINT(1) NOT NULL DEFAULT 0 AFTER is_assessor;
