import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchProductsQueryDto } from './search-products-query.dto';

const transform = (query: Record<string, unknown>) =>
  plainToInstance(SearchProductsQueryDto, query);

const validateQuery = (query: Record<string, unknown>) =>
  validate(transform(query));

describe('SearchProductsQueryDto', () => {
  it('normalizes Unicode and display whitespace', async () => {
    const dto = transform({ query: '  ３％\t Milk  ' });

    expect(dto.query).toBe('3% Milk');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([{}, { query: 10 }, { query: '' }, { query: ' \t\n ' }])(
    'rejects an invalid query: %j',
    async (query) => {
      expect(await validateQuery(query)).not.toHaveLength(0);
    },
  );

  it.each(['M', '🛒'])(
    'accepts 200 normalized %s characters and rejects 201',
    async (character) => {
      await expect(
        validateQuery({ query: ` ${character.repeat(200)} ` }),
      ).resolves.toHaveLength(0);
      expect(
        await validateQuery({ query: character.repeat(201) }),
      ).not.toHaveLength(0);
    },
  );

  it.each([undefined, '1', '20'])(
    'accepts optional valid limit %j',
    async (limit) => {
      const dto = transform({ query: 'milk', limit });

      await expect(validate(dto)).resolves.toHaveLength(0);
      expect(dto.limit).toBe(limit === undefined ? undefined : Number(limit));
    },
  );

  it.each(['0', '1.5', 'not-a-number', '21'])(
    'rejects invalid limit %j',
    async (limit) => {
      expect(await validateQuery({ query: 'milk', limit })).not.toHaveLength(0);
    },
  );
});
