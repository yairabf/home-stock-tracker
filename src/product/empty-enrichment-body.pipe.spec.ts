import { EmptyEnrichmentBodyPipe } from './empty-enrichment-body.pipe';
const pipe = new EmptyEnrichmentBodyPipe();
describe('empty enrichment body', () => {
  it.each([{}, undefined])('accepts %p', (value) =>
    expect(pipe.transform(value)).toBeUndefined(),
  );
  it.each([
    null,
    [],
    true,
    1,
    'force',
    { force: true },
    { isPerishable: false },
  ])('rejects %p', (value) => {
    expect(() => pipe.transform(value)).toThrow(
      'Product enrichment accepts only an empty body',
    );
  });
});
