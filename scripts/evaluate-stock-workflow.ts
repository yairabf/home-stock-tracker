import { runWorkflowCli } from '../src/evaluation/stock-prediction/workflow-cli';
void runWorkflowCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch(() => {
    console.error(
      'Stock workflow evaluation failed validation or execution; no rollout was performed.',
    );
    process.exitCode = 1;
  });
