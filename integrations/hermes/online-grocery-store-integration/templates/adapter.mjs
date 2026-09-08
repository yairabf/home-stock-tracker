const COMMAND_OPTIONS = {
  status: [],
  cart: [],
  search: ['query'],
  ensure: ['query', 'product-id', 'quantity'],
};

function result(state, command, message) {
  process.stdout.write(`${JSON.stringify({ state, command, message })}\n`);
  process.exitCode = 1;
}

function parseOptions(command, argv) {
  const expected = COMMAND_OPTIONS[command];
  const values = new Map();

  if (!expected) {
    throw new Error('Unknown adapter command');
  }
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error('Expected --option value pairs');
    }
    const name = option.slice(2);
    if (!expected.includes(name) || values.has(name)) {
      throw new Error('Unknown or duplicate command option');
    }
    values.set(name, value);
  }
  for (const name of expected) {
    if (!values.get(name)?.trim()) {
      throw new Error('Missing required command option');
    }
  }
  if (command === 'ensure') {
    const quantity = Number(values.get('quantity'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Quantity must be positive and finite');
    }
  }
}

const [command = '', ...argv] = process.argv.slice(2);
try {
  parseOptions(command, argv);
  result(
    'not_implemented',
    command,
    'Store-specific adapter behavior has not been implemented.',
  );
} catch (error) {
  const safeCommand = Object.hasOwn(COMMAND_OPTIONS, command)
    ? command
    : 'unknown';
  result('error', safeCommand, error.message);
}
