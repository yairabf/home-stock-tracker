import { FeedbackStatus, PredictedState } from '../../generated/prisma/enums';
import { PredictionFeedbackOutcome } from './prediction-feedback.dto';

export class PredictionFeedbackResponseDto {
  predictionId: string;
  productId: string;
  feedbackStatus: FeedbackStatus;
  outcome: PredictionFeedbackOutcome;
  correctedState: PredictedState | null;
  feedbackEventId: string;
  predictionAccuracy: number;
}
