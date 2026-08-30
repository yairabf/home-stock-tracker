import {
  IsDefined,
  IsEnum,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { PredictedState } from '../../generated/prisma/enums';

export enum PredictionFeedbackOutcome {
  accepted = 'accepted',
  rejected = 'rejected',
  corrected = 'corrected',
}

const CORRECTED_STATES = new Set<PredictedState>([
  PredictedState.likely_available,
  PredictedState.probably_low,
  PredictedState.probably_out,
]);

@ValidatorConstraint({ name: 'correctedStateMatchesOutcome' })
export class CorrectedStateMatchesOutcomeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const object = args.object as PredictionFeedbackDto;
    if (object.outcome === PredictionFeedbackOutcome.corrected) {
      return CORRECTED_STATES.has(value as PredictedState);
    }
    return value === undefined;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as PredictionFeedbackDto;
    return object.outcome === PredictionFeedbackOutcome.corrected
      ? 'correctedState must be a concrete predicted state for corrected feedback'
      : 'correctedState is only allowed for corrected feedback';
  }
}

export class PredictionFeedbackDto {
  @IsEnum(PredictionFeedbackOutcome)
  @IsDefined()
  outcome: PredictionFeedbackOutcome;

  @Validate(CorrectedStateMatchesOutcomeConstraint)
  correctedState?: PredictedState;
}
