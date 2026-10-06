export const PERISHABILITY_DEFINITION_VERSION =
  'normal-purchased-form-v1' as const;
export const PERISHABILITY_DEFINITIONS = {
  perishable:
    'The identified product in its normal purchased form ordinarily spoils over a short household storage period.',
  nonperishable:
    'The identified product form is shelf-stable or a durable household consumable. This does not mean it lasts forever.',
  unknown:
    'Product identity, relevant product form or conflicting supplied facts prevent a classification. Missing exact expiration or a stored classification alone is insufficient reason to abstain.',
} as const;
