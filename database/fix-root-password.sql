-- Corrigir senha do root (marcus.lopes / *.Admin14!)
-- Execute no phpMyAdmin do banco u179630068_mvp_ariane

UPDATE users
SET password_hash = '$2a$12$ZJlL4k1TpvAWzoLPF/nVauaX10aHRCkEXATi6mX885lUUi4ev910q',
    active = 1,
    role = 'root'
WHERE username = 'marcus.lopes';

-- Se o usuário ainda não existir, use:
INSERT INTO users (username, email, password_hash, name, role, active)
SELECT 'marcus.lopes', 'marcus@arianeandradeassessoria.app.br',
       '$2a$12$ZJlL4k1TpvAWzoLPF/nVauaX10aHRCkEXATi6mX885lUUi4ev910q',
       'Marcus Lopes', 'root', 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'marcus.lopes');
