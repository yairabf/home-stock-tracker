import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PredictedState } from '../../generated/prisma/enums';
import {
  PredictionFeedbackDto,
  PredictionFeedbackOutcome,
} from './prediction-feedback.dto';

const validateBody = (body: Record<string, unknown>) =>
  validate(plainToInstance(PredictionFeedbackDto, body));

describe('PredictionFeedbackDto', () => {
  it.each([
    PredictionFeedbackOutcome.accepted,
    PredictionFeedbackOutcome.rejected,
  ])('accepts %s without a corrected state', async (outcome) => {
    await expect(validateBody({ outcome })).resolves.toHaveLength(0);
  });

  it('accepts corrected feedback with a concrete state', async () => {
    await expect(
      validateBody({
        outcome: PredictionFeedbackOutcome.corrected,
        correctedState: PredictedState.probably_out,
      }),
    ).resolves.toHaveLength(0);
  });

  it.each([
    { outcome: 'corrected' },
    { outcome: 'corrected', correctedState: 'uncertain' },
    { outcome: 'accepted', correctedState: 'probably_out' },
    { outcome: 'invalid' },
  ])('rejects an invalid body: %j', async (body) => {
    expect(await validateBody(body)).not.toHaveLength(0);
  });
});
