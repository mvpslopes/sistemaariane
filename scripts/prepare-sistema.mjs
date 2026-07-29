import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist', 'sistema');

if (!existsSync(outDir)) {
  console.error('❌ Pasta dist/sistema não encontrada. Rode o build do Vite antes.');
  process.exit(1);
}

const copies = [
  ['backend/api.php', 'api.php'],
  ['backend/db-check.php', 'db-check.php'],
  ['backend/config.local.php', 'config.local.php'],
  ['backend/config.example.php', 'config.example.php'],
  ['database/schema.sql', 'schema.sql'],
  ['database/fix-root-password.sql', 'fix-root-password.sql'],
  ['database/seed-ficticios.sql', 'seed-ficticios.sql'],
  ['database/seed-fotos-animais.sql', 'seed-fotos-animais.sql'],
];

// Garante pasta de uploads no pacote de deploy
const uploadsAnimals = join(outDir, 'uploads', 'animals');
mkdirSync(uploadsAnimals, { recursive: true });
writeFileSync(join(uploadsAnimals, '.gitkeep'), '');
writeFileSync(join(uploadsAnimals, '.htaccess'), 'Options -Indexes\n');
console.log('✓ uploads/animals/');

for (const [fromRel, toRel] of copies) {
  const from = join(root, fromRel);
  const to = join(outDir, toRel);
  if (!existsSync(from)) {
    console.warn(`⚠️  Pulado (não encontrado): ${fromRel}`);
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`✓ ${toRel}`);
}

writeFileSync(
  join(outDir, 'LEIA-ME-UPLOAD.txt'),
  `UPLOAD — Subdomínio sistema.arianeandradeassessoria.app.br

1. No File Manager da Hostinger, abra a pasta do subdomínio "sistema"
   (geralmente public_html/sistema ou a pasta apontada pelo subdomínio).

2. Envie TODOS os arquivos e pastas que estão DENTRO desta pasta
   (index.html, assets/, api.php, config.local.php, .htaccess, etc.).

3. No phpMyAdmin, importe schema.sql no banco u179630068_mvp_ariane
   (só na primeira vez).

4. Confirme que a pasta uploads/animals existe e tem permissão de escrita
   (chmod 755 ou 775 no File Manager). Fotos dos animais são salvas aí.

5. Teste:
   - https://sistema.arianeandradeassessoria.app.br/
   - https://sistema.arianeandradeassessoria.app.br/api.php/health

Login root: marcus.lopes
`
);

console.log('\n✅ Pacote pronto em: dist/sistema/');
console.log('   Suba o conteúdo dessa pasta na hospedagem do subdomínio.');
