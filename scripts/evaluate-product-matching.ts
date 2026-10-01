import { runCli } from '../src/evaluation/product-matching/cli';

void runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch(() => {
    console.error(
      'Evaluation failed. Check arguments, dataset/replay validation, private live configuration and a new writable output path.',
    );
    process.exitCode = 1;
  });
