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
  ['database/seed-leiloes.sql', 'seed-leiloes.sql'],
  ['database/migration-contratos.sql', 'migration-contratos.sql'],
  ['database/migration-avatar-usuarios.sql', 'migration-avatar-usuarios.sql'],
  ['database/migration-testemunha.sql', 'migration-testemunha.sql'],
  ['database/migration-leiloes-repasses.sql', 'migration-leiloes-repasses.sql'],
  ['database/migration-modelos-contrato.sql', 'migration-modelos-contrato.sql'],
  ['database/migration-pessoas-completo.sql', 'migration-pessoas-completo.sql'],
  ['database/migration-animal-catalogos.sql', 'migration-animal-catalogos.sql'],
  ['database/migration-categorias-cotas.sql', 'migration-categorias-cotas.sql'],
  ['database/migration-contrato-verso.sql', 'migration-contrato-verso.sql'],
  ['database/migration-endereco-numero.sql', 'migration-endereco-numero.sql'],
  ['database/migration-papel-avalista.sql', 'migration-papel-avalista.sql'],
  ['database/migration-lote-vendedores.sql', 'migration-lote-vendedores.sql'],
  ['database/migration-via-das-partes.sql', 'migration-via-das-partes.sql'],
  ['database/wipe-dados-operacionais.sql', 'wipe-dados-operacionais.sql'],
  ['database/seed-modelo-contrato-padrao.sql', 'seed-modelo-contrato-padrao.sql'],
  ['database/seed-papeis.sql', 'seed-papeis.sql'],
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

2. Envie TODOS os arquivos e pastas que estão DENTRO desta pasta
   (index.html, assets/, api.php, config.local.php, .htaccess, etc.).

3. No phpMyAdmin, importe schema.sql no banco u179630068_mvp_ariane
   (só na primeira vez). Se o banco já existir, importe também
   migration-contratos.sql (papéis, contratos e cobranças).

4. Confirme que as pastas uploads/animals e uploads/avatars existem e têm
   permissão de escrita (chmod 755 ou 775). Fotos de animais e avatares
   ficam nessas pastas.

5. Se o banco já existir, rode também migration-avatar-usuarios.sql
   (coluna avatar_url em users), migration-testemunha.sql,
   migration-leiloes-repasses.sql (leilões, lotes e repasses),
   migration-pessoas-completo.sql, migration-animal-catalogos.sql,
   migration-categorias-cotas.sql e migration-contrato-verso.sql.

6. Teste:
   - https://sistema.arianeandradeassessoria.app.br/
   - https://sistema.arianeandradeassessoria.app.br/api.php/health

Login root: marcus.lopes
`
);

console.log('\n✅ Pacote pronto em: dist/sistema/');
console.log('   Suba o conteúdo dessa pasta na hospedagem do subdomínio.');
