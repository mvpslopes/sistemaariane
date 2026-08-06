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
];

// Garante pasta de uploads no pacote de deploy
const uploadsAnimals = join(outDir, 'uploads', 'animals');
mkdirSync(uploadsAnimals, { recursive: true });
writeFileSync(join(uploadsAnimals, '.gitkeep'), '');
writeFileSync(join(uploadsAnimals, '.htaccess'), 'Options -Indexes\n');
console.log('✓ uploads/animals/');

const uploadsAvatars = join(outDir, 'uploads', 'avatars');
mkdirSync(uploadsAvatars, { recursive: true });
writeFileSync(join(uploadsAvatars, '.gitkeep'), '');
writeFileSync(join(uploadsAvatars, '.htaccess'), 'Options -Indexes\n');
console.log('✓ uploads/avatars/');

const uploadsPersons = join(outDir, 'uploads', 'persons');
mkdirSync(uploadsPersons, { recursive: true });
writeFileSync(join(uploadsPersons, '.gitkeep'), '');
writeFileSync(join(uploadsPersons, '.htaccess'), 'Options -Indexes\n');
console.log('✓ uploads/persons/');

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

2. Envie: index.html, assets/, api.php, .htaccess, config.local.php.
   NÃO sobrescreva a pasta uploads/ (fotos já existentes).

3. Scripts SQL ficam em database/ no repositório — use o phpMyAdmin
   quando precisar (não vão no pacote de deploy).

4. Confirme que uploads/animals, uploads/avatars e uploads/persons
   existem com permissão de escrita (chmod 755 ou 775).

5. Teste:
   - https://sistema.arianeandradeassessoria.app.br/
   - https://sistema.arianeandradeassessoria.app.br/api.php/health

Login root: marcus.lopes
`
);

console.log('\n✅ Pacote pronto em: dist/sistema/');
console.log('   Suba o conteúdo dessa pasta na hospedagem do subdomínio.');
