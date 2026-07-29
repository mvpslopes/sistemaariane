-- =============================================================================
-- Migration: avatar do usuário (foto de perfil)
-- Rode uma vez no phpMyAdmin (banco u179630068_mvp_ariane)
-- =============================================================================

ALTER TABLE users
  ADD COLUMN avatar_url VARCHAR(500) NULL AFTER name;
