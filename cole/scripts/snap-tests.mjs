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
//   node cole/scripts/snap-tests.mjs            run
//   node cole/scripts/snap-tests.mjs --update   write/refresh snapshots
import { spawnSync } from "node:child_process";

const update = process.argv.includes("--update");
const args = [
  "--import", "ts-node/esm",
  "--test",
  ...(update ? ["--test-update-snapshots"] : []),
  "cole/__tests__/*.test.ts",
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
