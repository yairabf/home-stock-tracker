import { runCli } from '../src/evaluation/stock-prediction/cli';

void runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch(() => {
    console.error(
      'Stock evaluation failed. Check arguments, bounded dataset/replay JSON, private live configuration and a new writable output path.',
    );
    process.exitCode = 1;
  });
