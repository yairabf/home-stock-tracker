export const JEV_TASKS = [
  'product_resolution',
  'product_understanding',
  'shelf_life_policy',
  'stock_prediction',
] as const;

export type JevTask = (typeof JEV_TASKS)[number];

export type JevJsonValue =
  null | string | boolean | number | JevJsonObject | JevJsonValue[];

export interface JevJsonObject {
  [key: string]: JevJsonValue;
}

export type JevChoiceCriteria = Record<
  string,
  string | JevJsonObject | JevJsonValue[] | null
>;

export interface JevChoiceRequest {
  task: JevTask;
  taskVersion: string;
  questionKey: string;
  state: JevJsonObject;
  instructions: string;
  criteria: JevChoiceCriteria;
}

export interface JevTokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface JevValidatedChoiceResponse {
  model: string;
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
  usage: JevTokenUsage;
}

export interface JevDecisionSuccess extends JevValidatedChoiceResponse {
  status: 'success';
  provider: 'typesafe';
  task: JevTask;
  taskVersion: string;
}

export const JEV_UNAVAILABLE_REASONS = [
  'not_configured',
  'invalid_request',
  'deadline_exceeded',
  'authentication_error',
  'request_rejected',
  'rate_limited',
  'provider_error',
  'network_error',
  'invalid_response',
] as const;

export type JevUnavailableReason = (typeof JEV_UNAVAILABLE_REASONS)[number];

export interface JevDecisionUnavailable {
  status: 'unavailable';
  provider: 'typesafe';
  model?: string;
  task: JevTask;
  taskVersion: string;
  reason: JevUnavailableReason;
}

export type JevDecisionResult = JevDecisionSuccess | JevDecisionUnavailable;

export type JevValidationResult<T, Reason extends JevUnavailableReason> =
  { status: 'valid'; value: T } | { status: 'invalid'; reason: Reason };
