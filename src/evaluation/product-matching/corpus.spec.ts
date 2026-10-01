import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectDataset, parseEvaluationDataset } from './dataset';

describe('authored matching corpus', () => {
  it('meets size/language/split requirements without claiming independent review', () => {
    const dataset = parseEvaluationDataset(
      JSON.parse(
        readFileSync(
          resolve(
            __dirname,
            '../../../evaluation/product-matching/cases.v1.json',
          ),
          'utf8',
        ),
      ),
    );
    expect(inspectDataset(dataset)).toMatchObject({
      caseCount: 168,
      splitCounts: { tuning: 48, held_out: 120 },
      corpusEligible: true,
      labelsReviewed: false,
      reviewedCount: 0,
      confirmedCount: 0,
      missingScenarios: [],
    });
    expect(
      new Set(dataset.cases.map((item) => item.context.requestedPhrase)).size,
    ).toBe(168);
  });
});
