import { Prisma } from '../generated/prisma/client';
import {
  catalogMetadataUpdate,
  assertCatalogIdentitySnapshot,
} from './assisted-catalog-policy';
import { isAssistedCatalogWriteRace } from './assisted-catalog-writer.service';
import { AssistedCatalogConflict } from './assisted-catalog-conflict';
import type { ProductSearchProduct } from '../product/types/product-search';

const empty = {
  category: null,
  typicalUnit: null,
  productType: null,
  isPerishable: null,
};
const snapshot: ProductSearchProduct = {
  id: 'product-id',
  canonicalName: 'milk',
  aliases: ['Nestle milk'],
  ...empty,
  predictionEnabled: true,
};

describe('assisted catalog write policy', () => {
  it('fills null fields including explicit false, without touching stored values', () => {
    expect(
      catalogMetadataUpdate(
        { ...empty, category: 'dairy' },
        { ...empty, category: 'dairy', isPerishable: false },
        null,
      ),
    ).toEqual({ isPerishable: false });
  });
  it('preserves concurrent facts when prepared metadata is unknown', () => {
    expect(
      catalogMetadataUpdate({ ...empty, isPerishable: false }, empty, empty),
    ).toEqual({});
  });
  it('rejects conflicting prepared facts', () => {
    expect(() =>
      catalogMetadataUpdate(
        { ...empty, isPerishable: true },
        { ...empty, isPerishable: false },
        null,
      ),
    ).toThrow(AssistedCatalogConflict);
  });
  it('rejects changed or removed previously known metadata', () => {
    for (const category of ['other', null])
      expect(() =>
        catalogMetadataUpdate({ ...empty, category }, empty, {
          ...empty,
          category: 'dairy',
        }),
      ).toThrow(AssistedCatalogConflict);
  });
  it('allows a concurrent equivalent fill', () => {
    expect(
      catalogMetadataUpdate(
        { ...empty, category: 'dairy' },
        { ...empty, category: 'dairy' },
        empty,
      ),
    ).toEqual({});
  });
  it('allows added aliases without invalidating original evidence', () => {
    expect(() =>
      assertCatalogIdentitySnapshot(
        { ...snapshot, aliases: ['Nestle milk', 'other milk'] },
        snapshot,
      ),
    ).not.toThrow();
  });
  it.each([
    { ...snapshot, id: 'other' },
    { ...snapshot, canonicalName: 'oat milk' },
    { ...snapshot, aliases: [] },
  ])('rejects changed identity evidence %#', (current) => {
    expect(() => assertCatalogIdentitySnapshot(current, snapshot)).toThrow(
      AssistedCatalogConflict,
    );
  });
  it('only retries Prisma uniqueness/serialization errors', () => {
    for (const code of ['P2002', 'P2034'])
      expect(
        isAssistedCatalogWriteRace(
          new Prisma.PrismaClientKnownRequestError('race', {
            code,
            clientVersion: 'test',
          }),
        ),
      ).toBe(true);
    expect(
      isAssistedCatalogWriteRace(new AssistedCatalogConflict('alias_conflict')),
    ).toBe(false);
    expect(isAssistedCatalogWriteRace({ code: 'P2002' })).toBe(false);
    expect(
      isAssistedCatalogWriteRace(
        new Prisma.PrismaClientKnownRequestError('gone', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      ),
    ).toBe(false);
  });
});
