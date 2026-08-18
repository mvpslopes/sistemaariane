-- Controle de sessão (forçar logout) — complemento do painel Root
-- Rodar no phpMyAdmin se ainda não aplicada.

ALTER TABLE users
  ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER last_seen_at;
