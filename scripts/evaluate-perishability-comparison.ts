import { runPerishabilityComparisonCli } from '../src/evaluation/application-inference/perishability-comparison-cli';
void runPerishabilityComparisonCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch(() => {
    console.error(
      'Perishability comparison failed validation or execution; no rollout was performed.',
    );
    process.exitCode = 1;
  });
