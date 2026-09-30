import type { JevChoiceRequest } from './jev-decision.types';
import {
  validateJevChoiceRequest,
  validateJevChoiceResponse,
} from './jev-decision.validation';

const REQUEST: JevChoiceRequest = {
  task: 'product_resolution',
  taskVersion: 'jev-product-resolution-v1',
  questionKey: 'match',
  state: { name: 'milk', history: [{ quantity: 1 }, false, null] },
  instructions: 'Choose the matching product.',
  criteria: { milk: 'The same product', none: null },
};
const INVALID_REQUEST = { status: 'invalid', reason: 'invalid_request' };
const INVALID_RESPONSE = { status: 'invalid', reason: 'invalid_response' };
const ANSWER = {
  type: 'choice',
  choice: 'milk',
  confidence: 0.96,
  probabilities: { milk: 0.8, none: 0.2 },
};

function responseFixture(
  answerOverrides: Record<string, unknown> = {},
  envelopeOverrides: Record<string, unknown> = {},
  request = REQUEST,
): unknown {
  return {
    model: 'jev-1.13.0',
    answers: { [request.questionKey]: { ...ANSWER, ...answerOverrides } },
    usage: { input_tokens: 12, output_tokens: 3 },
    ...envelopeOverrides,
  };
}

describe('validateJevChoiceRequest', () => {
  it.each(['product_resolution', 'stock_prediction'] as const)(
    'accepts the %s task',
    (task) => {
      const request = { ...REQUEST, task };
      expect(validateJevChoiceRequest(request)).toEqual({
        status: 'valid',
        value: request,
      });
    },
  );

  it.each([
    ['task', 'other'],
    ['taskVersion', ' '],
    ['questionKey', ''],
    ['instructions', ' '],
    ['instructions', 1],
    ['state', null],
    ['state', []],
    ['state', 'text'],
    ['criteria', null],
    ['criteria', []],
  ])('rejects invalid %s fields', (field, value) => {
    expect(validateJevChoiceRequest({ ...REQUEST, [field]: value })).toEqual(
      INVALID_REQUEST,
    );
  });

  it.each([0, 1, 2, 255, 256])('enforces the option count at %i', (count) => {
    const criteria = Object.fromEntries(
      Array.from({ length: count }, (_, index) => [`option_${index}`, null]),
    );
    expect(validateJevChoiceRequest({ ...REQUEST, criteria }).status).toBe(
      count >= 2 && count <= 255 ? 'valid' : 'invalid',
    );
  });

  it('rejects blank option tokens while preserving nonblank token identity', () => {
    expect(
      validateJevChoiceRequest({
        ...REQUEST,
        criteria: { ' ': null, none: null },
      }),
    ).toEqual(INVALID_REQUEST);
    const request = {
      ...REQUEST,
      questionKey: ' padded key ',
      criteria: { ' padded option ': '', none: null },
    };
    expect(validateJevChoiceRequest(request)).toEqual({
      status: 'valid',
      value: request,
    });
  });

  it('accepts JSON object and array rubrics with nested numbers and booleans', () => {
    const request = {
      ...REQUEST,
      criteria: {
        milk: { nested: [1, true, null] },
        none: ['other', { matches: false }],
      },
    };
    expect(validateJevChoiceRequest(request)).toEqual({
      status: 'valid',
      value: request,
    });
  });

  it.each([0, 1, true, false])(
    'rejects scalar numeric or boolean rubrics',
    (value) => {
      expect(
        validateJevChoiceRequest({
          ...REQUEST,
          criteria: { milk: value, none: null },
        }),
      ).toEqual(INVALID_REQUEST);
    },
  );

  it.each([
    undefined,
    NaN,
    Infinity,
    -Infinity,
    1n,
    Symbol('invalid'),
    () => null,
    new Date(),
    new Map(),
    new Set(),
  ])('rejects non-JSON values in state and rubrics', (value) => {
    expect(
      validateJevChoiceRequest({ ...REQUEST, state: { nested: value } }),
    ).toEqual(INVALID_REQUEST);
    expect(
      validateJevChoiceRequest({
        ...REQUEST,
        criteria: { milk: [value], none: null },
      }),
    ).toEqual(INVALID_REQUEST);
  });

  it('rejects cycles but accepts repeated references without a cycle', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(validateJevChoiceRequest({ ...REQUEST, state: cyclic })).toEqual(
      INVALID_REQUEST,
    );
    expect(
      validateJevChoiceRequest({
        ...REQUEST,
        criteria: { milk: [cyclic], none: null },
      }),
    ).toEqual(INVALID_REQUEST);
    const shared = { count: 2 };
    expect(
      validateJevChoiceRequest({
        ...REQUEST,
        state: { first: shared, second: shared },
      }).status,
    ).toBe('valid');
  });

  it('rejects accessors, symbols, hidden properties, sparse arrays and inherited fields', () => {
    const getter = jest.fn(() => {
      throw new Error('private accessor detail');
    });
    const accessor = Object.defineProperty({}, 'nested', {
      enumerable: true,
      get: getter,
    });
    const hidden = Object.defineProperty({}, 'nested', { value: 1 });
    for (const value of [
      accessor,
      hidden,
      { [Symbol('key')]: 1 },
      { list: new Array(2) },
      { list: Object.assign([1], { extra: 2 }) },
    ]) {
      expect(validateJevChoiceRequest({ ...REQUEST, state: value })).toEqual(
        INVALID_REQUEST,
      );
    }
    expect(validateJevChoiceRequest(Object.create(REQUEST))).toEqual(
      INVALID_REQUEST,
    );
    expect(
      validateJevChoiceRequest({
        ...REQUEST,
        criteria: Object.create(REQUEST.criteria) as unknown,
      }),
    ).toEqual(INVALID_REQUEST);
    expect(getter).not.toHaveBeenCalled();
  });

  it('contains inspection exceptions without returning raw details', () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('private proxy detail');
        },
      },
    );
    expect(validateJevChoiceRequest(hostile)).toEqual(INVALID_REQUEST);
  });
});

describe('validateJevChoiceResponse', () => {
  it('returns only validated fields, retaining resolved model and distinct confidence', () => {
    const result = validateJevChoiceResponse(
      responseFixture(
        {},
        { model: 'jev-2.10.3', privateMetadata: 'private response detail' },
      ),
      REQUEST,
    );
    expect(result).toEqual({
      status: 'valid',
      value: {
        model: 'jev-2.10.3',
        choice: 'milk',
        confidence: 0.96,
        probabilities: { milk: 0.8, none: 0.2 },
        usage: { input_tokens: 12, output_tokens: 3 },
      },
    });
    expect(JSON.stringify(result)).not.toContain('private response detail');
  });

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'handles the own option and question key %s',
    (token) => {
      const request = {
        ...REQUEST,
        questionKey: token,
        criteria: Object.fromEntries([
          [token, 'matches'],
          ['none', null],
        ]),
      };
      const probabilities = Object.fromEntries([
        [token, 0.8],
        ['none', 0.2],
      ]);
      expect(validateJevChoiceRequest(request).status).toBe('valid');
      const result = validateJevChoiceResponse(
        responseFixture({ choice: token, probabilities }, {}, request),
        request,
      );
      expect(result.status).toBe('valid');
      if (result.status === 'valid') {
        expect(Object.hasOwn(result.value.probabilities, token)).toBe(true);
        expect(result.value.probabilities[token]).toBe(0.8);
        expect(Object.getPrototypeOf(result.value.probabilities)).toBe(
          Object.prototype,
        );
      }
    },
  );

  it('accepts null-prototype JSON maps and does not retain mutable response maps', () => {
    const probabilities = Object.assign(
      Object.create(null) as Record<string, number>,
      { milk: 0.8, none: 0.2 },
    );
    const usage = { input_tokens: 0, output_tokens: Number.MAX_SAFE_INTEGER };
    const answers = Object.assign(
      Object.create(null) as Record<string, unknown>,
      { match: { ...ANSWER, probabilities } },
    );
    const result = validateJevChoiceResponse(
      responseFixture({}, { answers, usage }),
      REQUEST,
    );
    expect(result.status).toBe('valid');
    probabilities.milk = 0;
    usage.input_tokens = 99;
    if (result.status === 'valid') {
      expect(result.value.probabilities.milk).toBe(0.8);
      expect(result.value.usage.input_tokens).toBe(0);
    }
  });

  it.each([undefined, null, [], {}, 'private payload'])(
    'rejects malformed envelopes without payloads',
    (value) => {
      expect(validateJevChoiceResponse(value, REQUEST)).toEqual(
        INVALID_RESPONSE,
      );
    },
  );

  it.each([
    undefined,
    null,
    '',
    ' ',
    'jev-latest',
    'jev-preview',
    'jev-1.13',
    'jev-1.13.0-extra',
    ' jev-1.13.0 ',
    1,
  ])('rejects malformed resolved models', (model) => {
    expect(
      validateJevChoiceResponse(responseFixture({}, { model }), REQUEST),
    ).toEqual(INVALID_RESPONSE);
  });

  it.each([
    undefined,
    null,
    [],
    {},
    { other: ANSWER },
    { match: ANSWER, other: ANSWER },
    Object.create({ match: ANSWER }),
  ])('requires exactly the requested own answer key', (answers) => {
    expect(
      validateJevChoiceResponse(responseFixture({}, { answers }), REQUEST),
    ).toEqual(INVALID_RESPONSE);
  });

  it.each([undefined, 'score', 'noul', 1])(
    'requires a Choice answer type',
    (type) => {
      expect(
        validateJevChoiceResponse(responseFixture({ type }), REQUEST),
      ).toEqual(INVALID_RESPONSE);
    },
  );

  it.each([undefined, 'unknown', 'toString', 1])(
    'requires an own requested choice',
    (choice) => {
      expect(
        validateJevChoiceResponse(responseFixture({ choice }), REQUEST),
      ).toEqual(INVALID_RESPONSE);
    },
  );

  it.each([undefined, null, '0.9', NaN, Infinity, -Infinity, -0.001, 1.001])(
    'requires finite confidence in range',
    (confidence) => {
      expect(
        validateJevChoiceResponse(responseFixture({ confidence }), REQUEST),
      ).toEqual(INVALID_RESPONSE);
    },
  );

  it.each([0, 1])('accepts confidence boundary %i', (confidence) => {
    expect(
      validateJevChoiceResponse(responseFixture({ confidence }), REQUEST)
        .status,
    ).toBe('valid');
  });

  it.each([
    undefined,
    null,
    [],
    { milk: 1 },
    { milk: 0.8, none: 0.2, other: 0 },
    { milk: NaN, none: 0.2 },
    { milk: Infinity, none: 0.2 },
    { milk: -0.1, none: 1.1 },
    { milk: '0.8', none: 0.2 },
    { milk: 0.4, none: 0.6 },
    { milk: 0, none: 0 },
    { milk: 1, none: 1 },
    Object.create({ milk: 0.8, none: 0.2 }),
  ])(
    'rejects invalid probability keys, values, totals or a nonmaximum selection',
    (probabilities) => {
      expect(
        validateJevChoiceResponse(responseFixture({ probabilities }), REQUEST),
      ).toEqual(INVALID_RESPONSE);
    },
  );

  it.each([
    [{ milk: 0.5, none: 0.5 }, true],
    [{ milk: 1, none: 0 }, true],
    [{ milk: 0.8, none: 0.199 }, true],
    [{ milk: 0.8, none: 0.201 }, true],
    [{ milk: 0.8, none: 0.198999 }, false],
    [{ milk: 0.8, none: 0.201001 }, false],
  ])(
    'handles ties, endpoints and the sum tolerance',
    (probabilities, valid) => {
      expect(
        validateJevChoiceResponse(responseFixture({ probabilities }), REQUEST)
          .status,
      ).toBe(valid ? 'valid' : 'invalid');
    },
  );

  it('accepts either selected option in a tied maximum', () => {
    expect(
      validateJevChoiceResponse(
        responseFixture({
          choice: 'none',
          probabilities: { milk: 0.5, none: 0.5 },
        }),
        REQUEST,
      ).status,
    ).toBe('valid');
  });

  describe.each(['input_tokens', 'output_tokens'])(
    '%s usage validation',
    (field) => {
      it.each([
        undefined,
        null,
        '1',
        -1,
        0.5,
        NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 1,
      ])('rejects invalid token counts', (count) => {
        expect(
          validateJevChoiceResponse(
            responseFixture(
              {},
              { usage: { input_tokens: 0, output_tokens: 0, [field]: count } },
            ),
            REQUEST,
          ),
        ).toEqual(INVALID_RESPONSE);
      });
    },
  );

  it.each([undefined, null, [], {}])('requires usage fields', (usage) => {
    expect(
      validateJevChoiceResponse(responseFixture({}, { usage }), REQUEST),
    ).toEqual(INVALID_RESPONSE);
  });

  it('rejects hidden/symbol probability keys and answer accessors without invoking them', () => {
    const getter = jest.fn(() => {
      throw new Error('private accessor detail');
    });
    const probabilities = { milk: 0.8, none: 0.2 };
    Object.defineProperty(probabilities, 'hidden', { value: 0 });
    expect(
      validateJevChoiceResponse(responseFixture({ probabilities }), REQUEST),
    ).toEqual(INVALID_RESPONSE);
    expect(
      validateJevChoiceResponse(
        responseFixture({
          probabilities: { ...ANSWER.probabilities, [Symbol('extra')]: 0 },
        }),
        REQUEST,
      ),
    ).toEqual(INVALID_RESPONSE);
    const answers = Object.defineProperty({}, REQUEST.questionKey, {
      enumerable: true,
      get: getter,
    });
    expect(
      validateJevChoiceResponse(responseFixture({}, { answers }), REQUEST),
    ).toEqual(INVALID_RESPONSE);
    expect(getter).not.toHaveBeenCalled();
  });

  it('ignores unrelated envelope metadata and contains hostile inspection failures', () => {
    const getter = jest.fn(() => {
      throw new Error('private metadata');
    });
    const valid = Object.defineProperty(
      responseFixture() as object,
      'metadata',
      { enumerable: true, get: getter },
    );
    expect(validateJevChoiceResponse(valid, REQUEST).status).toBe('valid');
    expect(getter).not.toHaveBeenCalled();
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('private proxy detail');
        },
      },
    );
    expect(validateJevChoiceResponse(hostile, REQUEST)).toEqual(
      INVALID_RESPONSE,
    );
  });
});
