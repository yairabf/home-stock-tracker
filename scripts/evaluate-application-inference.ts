import { runCli } from '../src/evaluation/application-inference/cli';
void runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch(() => {
    console.error(
      'Application evaluation failed validation or execution; no rollout was performed.',
    );
    process.exitCode = 1;
  });
