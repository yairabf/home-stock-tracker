import { workflowFixture } from './workflow-fixture';
import { assertWorkflowDatabase } from './workflow-seed';
import { workflowBinding, parseWorkflowRecording } from './workflow-recording';
import {
  createWorkflowReport,
  validateWorkflowReport,
} from './workflow-report';
import { runWorkflowEvaluation } from './workflow-runner';
import type { RunMetadata } from '../application-inference/launch-policy';

describe('Workflow isolation and evidence gates', () => {
  it('rejects production, nonlocal and ambiguous database names before connecting', async () => {
    for (const url of [
      'postgresql://u:p@remote/home_stock_eval_example_test',
      'postgresql://u:p@localhost/home_stock_tracker',
      'postgresql://u:p@localhost/general_test',
      'http://localhost/home_stock_eval_example_test',
    ]) {
      expect(() => assertWorkflowDatabase(url)).toThrow();
      await expect(
        runWorkflowEvaluation(
          {},
          { databaseUrl: url, split: 'held_out', model: 'jev-1.13.0' },
        ),
      ).rejects.toThrow();
    }
    expect(
      assertWorkflowDatabase(
        'postgresql://fixture:fixture@127.0.0.1:55438/home_stock_eval_example_test',
      ),
    ).toBe('home_stock_eval_example_test');
  });
  it('binds recordings to cutoff-known snapshots and disallows stock generation', () => {
    const d = workflowFixture();
    const r = {
      ...workflowBinding(d, 'held_out', 'jev-1.13.0'),
      rows: [{ caseId: d.history.cases[0].id, calls: [] }],
    };
    expect(parseWorkflowRecording(r, d, 'held_out')).toEqual(r);
    expect(() =>
      parseWorkflowRecording(
        { ...r, inputHash: '0'.repeat(64) },
        d,
        'held_out',
      ),
    ).toThrow();
    expect(() =>
      parseWorkflowRecording(
        { ...r, rows: [...r.rows, ...r.rows] },
        d,
        'held_out',
      ),
    ).toThrow();
  });
  it('keeps authored and missing 37e evidence inconclusive and rejects summary edits', () => {
    const d = workflowFixture();
    const metadata: RunMetadata = {
      evidenceMode: 'offline',
      startedAt: '2026-02-01T00:00:00Z',
      finishedAt: '2026-02-01T00:01:00Z',
      codeRevision: 'a'.repeat(40),
      codeDirty: false,
      dirtyPaths: [],
      complete: false,
      physicalRequests: null,
    };
    const report = createWorkflowReport(
      d,
      'held_out',
      'jev-1.13.0',
      [],
      metadata,
    );
    expect(report.launchEvidence).toBe('inconclusive');
    expect(report.launchReasons).toContain('qualifying_37e_evidence_missing');
    expect(validateWorkflowReport(report, d)).toEqual(report);
    expect(() =>
      validateWorkflowReport({ ...report, launchEvidence: 'eligible' }, d),
    ).toThrow();
    expect(() =>
      validateWorkflowReport(
        { ...report, metrics: { ...report.metrics, completed: 100 } },
        d,
      ),
    ).toThrow();
  });
});
