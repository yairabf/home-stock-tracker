import { createApplicationLogger, parseLogLevels } from './log-levels';

describe('log levels', () => {
  it('defaults to operational log levels', () => {
    expect(parseLogLevels(undefined)).toEqual([
      'fatal',
      'error',
      'warn',
      'log',
    ]);
  });

  it.each([
    ['fatal', ['fatal']],
    ['error', ['fatal', 'error']],
    ['warn', ['fatal', 'error', 'warn']],
    ['log', ['fatal', 'error', 'warn', 'log']],
    ['debug', ['fatal', 'error', 'warn', 'log', 'debug']],
    ['verbose', ['fatal', 'error', 'warn', 'log', 'debug', 'verbose']],
  ])('maps %s to its severity threshold', (value, expected) => {
    expect(parseLogLevels(value)).toEqual(expected);
  });

  it.each(['', 'INFO', 'info', 'trace', ' log '])(
    'rejects unsupported LOG_LEVEL %p',
    (value) => {
      expect(() => parseLogLevels(value)).toThrow(
        'LOG_LEVEL must be one of: fatal, error, warn, log, debug, verbose',
      );
    },
  );

  it('writes parseable single-line JSON', () => {
    const output = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const logger = createApplicationLogger('log');

    logger.log(
      { event: 'inventory.action', outcome: 'success' },
      'TestContext',
    );

    const line = String(output.mock.calls[0][0]).trim();
    expect(JSON.parse(line)).toMatchObject({
      level: 'log',
      context: 'TestContext',
      message: { event: 'inventory.action', outcome: 'success' },
    });
    output.mockRestore();
  });
});
