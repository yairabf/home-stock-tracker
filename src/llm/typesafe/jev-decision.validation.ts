import { z } from 'zod';
import { JEV_TASKS } from './jev-decision.types';
import type {
  JevChoiceCriteria,
  JevChoiceRequest,
  JevJsonObject,
  JevJsonValue,
  JevValidatedChoiceResponse,
  JevValidationResult,
} from './jev-decision.types';

const nonblankString = z.string().refine((value) => value.trim().length > 0);
const probability = z.number().min(0).max(1);
const tokenCount = z
  .number()
  .refine((value) => Number.isSafeInteger(value) && value >= 0);
const REQUEST_FIELDS = [
  'task',
  'taskVersion',
  'questionKey',
  'state',
  'instructions',
  'criteria',
];
const ANSWER_FIELDS = ['type', 'choice', 'confidence', 'probabilities'];
const PROBABILITY_SUM_TOLERANCE = 0.001;

const requestSchema = z.object({
  task: z.enum(JEV_TASKS),
  taskVersion: nonblankString,
  questionKey: nonblankString,
  state: z.custom<JevJsonObject>(validateJevJsonObject),
  instructions: nonblankString,
  criteria: z.custom<JevChoiceCriteria>(isChoiceCriteria),
});

const responseSchema = z.object({
  model: z.string().regex(/^jev-\d+\.\d+\.\d+$/),
  answer: z.object({
    type: z.literal('choice'),
    choice: z.string(),
    confidence: probability,
    probabilities: z.custom<Record<string, number>>(isProbabilityMap),
  }),
  usage: z.object({ input_tokens: tokenCount, output_tokens: tokenCount }),
});

export function validateJevJsonObject(value: unknown): value is JevJsonObject {
  try {
    return isRecord(value) && isFiniteJsonValue(value);
  } catch {
    return false;
  }
}

export function validateJevChoiceRequest(
  value: unknown,
): JevValidationResult<JevChoiceRequest, 'invalid_request'> {
  try {
    if (
      !isRecord(value) ||
      !isFiniteJsonValue(value) ||
      !hasOwnDataFields(value, REQUEST_FIELDS)
    ) {
      return { status: 'invalid', reason: 'invalid_request' };
    }
    const parsed = requestSchema.safeParse(value);
    if (parsed.success) return { status: 'valid', value: parsed.data };
  } catch {
    // Invalid objects must not expose accessor errors or parser details.
  }
  return { status: 'invalid', reason: 'invalid_request' };
}

export function validateJevChoiceResponse(
  value: unknown,
  request: JevChoiceRequest,
): JevValidationResult<JevValidatedChoiceResponse, 'invalid_response'> {
  try {
    const fields = readChoiceResponse(value, request.questionKey);
    const parsed = responseSchema.safeParse(fields);
    if (
      parsed.success &&
      matchesCriteria(parsed.data.answer, request.criteria)
    ) {
      const { model, answer, usage } = parsed.data;
      return {
        status: 'valid',
        value: {
          model,
          choice: answer.choice,
          confidence: answer.confidence,
          probabilities: Object.fromEntries(
            Object.entries(answer.probabilities),
          ),
          usage,
        },
      };
    }
  } catch {
    // Unknown provider data can throw while being inspected.
  }
  return { status: 'invalid', reason: 'invalid_response' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwnDataFields(
  value: Record<string, unknown>,
  fields: string[],
): boolean {
  return fields.every((field) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return (
      descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value')
    );
  });
}

function isFiniteJsonValue(
  value: unknown,
  ancestors = new Set<object>(),
): value is JevJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || (!Array.isArray(value) && !isRecord(value)))
    return false;
  if (ancestors.has(value) || Object.getOwnPropertySymbols(value).length > 0)
    return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value)) {
    if (Object.keys(descriptors).length !== value.length + 1) return false;
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(descriptors, String(index))) return false;
    }
  }
  ancestors.add(value);
  const valid = Object.entries(descriptors).every(
    ([key, descriptor]) =>
      (Array.isArray(value) && key === 'length') ||
      (descriptor.enumerable === true &&
        Object.hasOwn(descriptor, 'value') &&
        isFiniteJsonValue(descriptor.value, ancestors)),
  );
  ancestors.delete(value);
  return valid;
}

function isChoiceCriteria(value: unknown): value is JevChoiceCriteria {
  if (!isRecord(value) || !isFiniteJsonValue(value)) return false;
  const options = Object.keys(value);
  return (
    options.length >= 2 &&
    options.length <= 255 &&
    options.every(
      (option) =>
        option.trim().length > 0 &&
        (value[option] === null ||
          typeof value[option] === 'string' ||
          typeof value[option] === 'object'),
    )
  );
}

function isProbabilityMap(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === 'string' &&
        hasOwnDataFields(value, [key]) &&
        probability.safeParse(value[key]).success,
    )
  );
}

interface ChoiceResponseFields {
  model: unknown;
  answer: unknown;
  usage: unknown;
}

function readChoiceResponse(
  value: unknown,
  questionKey: string,
): ChoiceResponseFields | null {
  if (
    !isRecord(value) ||
    !hasOwnDataFields(value, ['model', 'answers', 'usage'])
  )
    return null;
  const { answers, usage } = value;
  if (
    !isRecord(answers) ||
    Reflect.ownKeys(answers).length !== 1 ||
    !hasOwnDataFields(answers, [questionKey])
  )
    return null;
  const answer = answers[questionKey];
  if (!isRecord(answer) || !hasOwnDataFields(answer, ANSWER_FIELDS))
    return null;
  if (
    !isRecord(usage) ||
    !hasOwnDataFields(usage, ['input_tokens', 'output_tokens'])
  )
    return null;
  return { model: value.model, answer, usage };
}

function matchesCriteria(
  answer: z.output<typeof responseSchema>['answer'],
  criteria: JevChoiceCriteria,
): boolean {
  const options = Object.keys(criteria);
  const { choice, probabilities } = answer;
  if (
    !Object.hasOwn(criteria, choice) ||
    Object.keys(probabilities).length !== options.length
  )
    return false;
  if (!options.every((option) => Object.hasOwn(probabilities, option)))
    return false;
  const values = options.map((option) => probabilities[option]);
  const sum = values.reduce((total, value) => total + value, 0);
  // Decimal boundary values can drift by a few ulps during summation.
  const tolerance = PROBABILITY_SUM_TOLERANCE + Number.EPSILON * options.length;
  return (
    Math.abs(sum - 1) <= tolerance &&
    values.every((value) => value <= probabilities[choice])
  );
}
