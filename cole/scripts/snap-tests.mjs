// Snapshot-test runner. Exists for ONE reason: the tests need
// TS_NODE_PROJECT=cole/tsconfig.json, and `VAR=x cmd` in an npm script does not
// work on Windows (npm runs scripts through cmd.exe). A three-line node wrapper
// is cheaper than taking cross-env as a dependency.
//
// WHY THE cole/ TSCONFIG SPECIFICALLY: the generators import each other without
// file extensions ("./verify-engine-native"). cole/tsconfig.json compiles to
// CommonJS, whose resolution allows that — and it is the same tsconfig
// cole-generate.ts runs under, so the tests exercise the production module graph.
// Under the ROOT tsconfig, ts-node emits ESM and every extensionless internal
// import fails with ERR_MODULE_NOT_FOUND. Verified both ways.
//
//   npm run test:snap                                   run everything
//   npm run test:snap:update                            write/refresh snapshots
//   npm run test:snap -- --test-name-pattern frcgw       scoped run
//   npm run test:snap:update -- --test-name-pattern frcgw   scoped update
//   npm run test:snap -- cole/__tests__/success-pages.snapshot.test.ts   one file
//
// FLAG PASS-THROUGH: anything after `--` reaches node:test verbatim, so scoped
// runs work through npm and the raw command does not become tribal knowledge.
// --update is consumed here (it maps to --test-update-snapshots and also sets
// COLE_SNAP_UPDATE); everything else is forwarded.
import { spawnSync } from "node:child_process";

// node:test flags that take a SEPARATE value token. Without this list, the value
// in `--test-name-pattern frcgw` would look like a positional and be mistaken for
// a test-file target — the run would silently test the wrong thing, which is
// worse than erroring.
const VALUE_FLAGS = new Set([
  "--test-name-pattern",
  "--test-skip-pattern",
  "--test-concurrency",
  "--test-timeout",
  "--test-reporter",
  "--test-reporter-destination",
  "--test-shard",
]);

const argv = process.argv.slice(2).filter(a => a !== "--update");
const update = process.argv.slice(2).includes("--update");

const passthrough = [];
const targets = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("-")) {
    passthrough.push(a);
    // `--flag value` (but not `--flag=value`, which is already one token)
    if (VALUE_FLAGS.has(a) && i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
      passthrough.push(argv[++i]);
    }
  } else {
    targets.push(a);
  }
}

const args = [
  "--import", "ts-node/esm",
  "--test",
  ...(update ? ["--test-update-snapshots"] : []),
  ...passthrough,
  ...(targets.length ? targets : ["cole/__tests__/*.test.ts"]),
];

// COLE_SNAP_UPDATE tells the hygiene test to stand down. node:test runs test FILES
// CONCURRENTLY, so during an update the hygiene check would read __snapshots__/
// while success-pages is still writing into it and report spurious "missing"
// files. Observed: 1 spurious failure on the run that wrote 96 snapshots, then
// pass 101 on the very next plain run. Skipping the directory checks during an
// update is correct — mid-write is not a state worth asserting on — and the next
// plain run asserts the finished result.
const r = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    TS_NODE_PROJECT: "cole/tsconfig.json",
    ...(update ? { COLE_SNAP_UPDATE: "1" } : {}),
  },
});
process.exit(r.status ?? 1);
