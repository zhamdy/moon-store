/**
 * CI guard: fail the build if the real-PostgreSQL suites were skipped.
 *
 * `describeWithPostgres` skips when TEST_DATABASE_URL is unset. That is correct locally
 * but catastrophic in CI, where a misconfigured service container would turn the entire
 * concurrency and idempotency proof into a green no-op. This asserts they actually ran.
 */
import fs from 'fs';

const REQUIRED_SUITE_PATTERN = /tests[/\\](support[/\\]realPostgres|concurrency[/\\])/;

const reportPath = process.argv[2];

if (!reportPath || !fs.existsSync(reportPath)) {
  console.error(`[ci-guard] vitest JSON report not found at "${reportPath}".`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const suites = (report.testResults ?? []).filter((s) => REQUIRED_SUITE_PATTERN.test(s.name));

if (suites.length === 0) {
  console.error('[ci-guard] No real-PostgreSQL suite files were found in the vitest report.');
  process.exit(1);
}

let executed = 0;
const skipped = [];

for (const suite of suites) {
  for (const test of suite.assertionResults ?? []) {
    if (test.status === 'passed' || test.status === 'failed') {
      executed += 1;
    } else {
      skipped.push(`${suite.name} › ${test.fullName ?? test.title}`);
    }
  }
}

if (executed === 0) {
  console.error(
    '[ci-guard] Every real-PostgreSQL test was skipped. TEST_DATABASE_URL is almost certainly ' +
      'unset or the postgres service is unreachable.'
  );
  process.exit(1);
}

if (skipped.length > 0) {
  console.error(`[ci-guard] ${skipped.length} real-PostgreSQL test(s) were skipped:`);
  for (const name of skipped) {
    console.error(`  - ${name}`);
  }
  process.exit(1);
}

console.log(`[ci-guard] ${executed} real-PostgreSQL test(s) executed across ${suites.length} file(s).`);
