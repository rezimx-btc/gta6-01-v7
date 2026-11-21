// MARAVELA: NEON TIDE — hand-in program (Node 22, standard library only).
// Copies the static game (game/) and the screenshots (screenshots/) from
// this repository into the output directory and writes dossier.json with
// the kit's vendored library, so the judge can read the entry.
//
// This program finishes and exits. It never starts a server, never listens
// on a port, and never waits for input. (The dev server lives in serve.ts,
// which the grader never runs.)
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  const shots = join(repoRoot, 'screenshots');
  if (existsSync(shots)) cpSync(shots, join(outDir, 'screenshots'), { recursive: true });
  // The gate's own caps: keep the entry inside them (at most 4 screenshots,
  // each at most 256 KiB; game/ at most 993 files and 48 MiB; dossier text
  // at most 160 KiB).
  writeFileSync(
    join(outDir, 'dossier.json'),
    buildDossier(outDir, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      game_max_files: 993,
      game_max_bytes: 50331648,
      game_path_max_bytes: 1000,
    }),
  );
  console.log(`MARAVELA: NEON TIDE handed in to ${outDir}`);
  const dossierSize = statSync(join(outDir, 'dossier.json')).size;
  console.log(`dossier.json: ${dossierSize} bytes`);
}

handIn();
