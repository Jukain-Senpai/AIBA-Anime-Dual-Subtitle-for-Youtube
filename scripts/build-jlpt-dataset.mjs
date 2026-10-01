import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OPENJLPT_COMMIT = '88eaef9c589f787194903e733c7f7b6df9d6ebc0';
const OPENJLPT_VERSION = '0.3.0';
const LEVEL_FILES = [
  ['N5', 'n5.json'],
  ['N4', 'n4.json'],
  ['N3', 'n3.json'],
  ['N2', 'n2.json'],
  ['N1', 'n1.json'],
];
const EXPECTED_COUNTS = { N5: 674, N4: 630, N3: 1659, N2: 1778, N1: 3070 };

function usage() {
  const script = fileURLToPath(import.meta.url);
  console.error(`Usage: node ${script} --source <OpenJLPT checkout> [--output <asset path>]`);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || (flag !== '--source' && flag !== '--output')) {
      usage();
      process.exit(2);
    }
    options[flag.slice(2)] = value;
  }
  if (!options.source) {
    usage();
    process.exit(2);
  }
  return options;
}

function assertPinnedCheckout(sourceDir) {
  let actualCommit;
  try {
    actualCommit = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error('The OpenJLPT source must be a Git checkout so its commit can be verified.');
  }

  if (actualCommit !== OPENJLPT_COMMIT) {
    throw new Error(`Expected OpenJLPT commit ${OPENJLPT_COMMIT}, received ${actualCommit}.`);
  }
}

function readEntries(sourceDir) {
  const entries = [];
  const counts = {};
  const ids = new Set();

  for (const [level, filename] of LEVEL_FILES) {
    const sourcePath = join(sourceDir, 'data', 'json', 'vocab', filename);
    const sourceEntries = JSON.parse(readFileSync(sourcePath, 'utf8'));
    counts[level] = sourceEntries.length;

    if (sourceEntries.length !== EXPECTED_COUNTS[level]) {
      throw new Error(
        `${level} count mismatch: expected ${EXPECTED_COUNTS[level]}, received ${sourceEntries.length}.`,
      );
    }

    for (const sourceEntry of sourceEntries) {
      if (!sourceEntry.id || !sourceEntry.word || !sourceEntry.reading) {
        throw new Error(`Invalid ${level} entry: id, word, and reading are required.`);
      }
      if (sourceEntry.level !== level) {
        throw new Error(`Level mismatch for ${sourceEntry.id}: ${sourceEntry.level} !== ${level}.`);
      }
      if (ids.has(sourceEntry.id)) {
        throw new Error(`Duplicate OpenJLPT vocabulary id: ${sourceEntry.id}.`);
      }
      ids.add(sourceEntry.id);

      const entry = {
        id: sourceEntry.id,
        expression: sourceEntry.word,
        reading: sourceEntry.reading,
        level,
      };
      if (sourceEntry.other_forms?.length) entry.other_forms = sourceEntry.other_forms;
      if (sourceEntry.other_readings?.length) entry.other_readings = sourceEntry.other_readings;
      entries.push(entry);
    }
  }

  return { entries, counts };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = resolve(args.source);
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outputPath = resolve(args.output ?? join(projectRoot, 'public', 'jlpt', 'jlpt-vocab.json'));
  const outputDir = dirname(outputPath);

  assertPinnedCheckout(sourceDir);
  const { entries, counts } = readEntries(sourceDir);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const dataset = {
    metadata: {
      name: 'OpenJLPT vocabulary subset for AIBA',
      source: 'https://github.com/evanclan/OpenJLPT',
      sourceVersion: OPENJLPT_VERSION,
      sourceCommit: OPENJLPT_COMMIT,
      license: 'CC-BY-SA-4.0',
      counts: { ...counts, total },
      transformation:
        'Retained only id, word→expression, reading, level, other_forms, and other_readings. Entry order follows N5→N1 source files. No vocabulary or levels were inferred.',
    },
    entries,
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(dataset)}\n`, 'utf8');
  copyFileSync(join(sourceDir, 'LICENSE'), join(outputDir, 'LICENSE-OpenJLPT.txt'));
  copyFileSync(join(sourceDir, 'NOTICE.md'), join(outputDir, 'NOTICE-OpenJLPT.md'));

  console.log(`Wrote ${entries.length} entries to ${outputPath}`);
  console.log(JSON.stringify({ ...counts, total }));
}

main();
