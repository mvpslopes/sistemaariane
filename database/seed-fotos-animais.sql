-- =========================================================
-- Fotos de demonstração para TODOS os animais
-- Banco: u179630068_mvp_ariane
-- Execute no phpMyAdmin (uma vez)
-- =========================================================
-- Usa LoremFlickr: gera uma foto de cavalo estável por ID
-- (mesmo animal = mesma foto ao recarregar).
-- Exemplo: https://loremflickr.com/400/400/horse,equine?lock=12
-- =========================================================

SET NAMES utf8mb4;

UPDATE animals
SET photo_url = CONCAT(
  'https://loremflickr.com/400/400/horse,equine?lock=',
  id
)
WHERE photo_url IS NULL
   OR photo_url = ''
   OR photo_url LIKE 'https://loremflickr.com/%';

-- Conferir:
-- SELECT id, name, photo_url FROM animals ORDER BY id;
