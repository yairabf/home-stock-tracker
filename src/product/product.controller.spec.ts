import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ProductType } from '../generated/prisma/enums';
import { ProductController } from './product.controller';
import { ProductSearchService } from './product-search.service';
import { ProductService } from './product.service';

describe('ProductController search', () => {
  let controller: ProductController;
  let searchService: { search: jest.Mock };

  beforeEach(async () => {
    searchService = { search: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: {} },
        { provide: ProductSearchService, useValue: searchService },
      ],
    }).compile();
    controller = module.get(ProductController);
  });

  it('registers a static GET route distinct from product ID lookup', () => {
    const prototype = ProductController.prototype as unknown as Record<
      string,
      unknown
    >;

    expect(Reflect.getMetadata(PATH_METADATA, prototype.search)).toBe('search');
    expect(Reflect.getMetadata(METHOD_METADATA, prototype.search)).toBe(
      RequestMethod.GET,
    );
    expect(Reflect.getMetadata(PATH_METADATA, prototype.findOne)).toBe(':id');
  });

  it('delegates once and exposes only compact response fields', async () => {
    searchService.search.mockResolvedValue({
      exactMatch: null,
      candidates: [
        {
          id: 'product-b',
          canonicalName: 'Milk B',
          aliases: ['B Milk'],
          category: 'dairy',
          typicalUnit: 'carton',
          productType: ProductType.fast_consumable,
          isPerishable: true,
          predictionEnabled: false,
          matchedName: 'internal',
        },
        {
          id: 'product-a',
          canonicalName: 'Milk A',
          aliases: [],
          category: null,
          typicalUnit: null,
          productType: null,
          isPerishable: false,
          predictionEnabled: true,
          proposal: { recommendation: 'internal' },
        },
      ],
    });

    const result = await controller.search({ query: 'Milk', limit: 2 });

    expect(searchService.search).toHaveBeenCalledTimes(1);
    expect(searchService.search).toHaveBeenCalledWith({
      query: 'Milk',
      limit: 2,
    });
    expect(result).toEqual({
      exactMatch: null,
      candidates: [
        {
          id: 'product-b',
          canonicalName: 'Milk B',
          aliases: ['B Milk'],
          category: 'dairy',
          typicalUnit: 'carton',
          productType: ProductType.fast_consumable,
          isPerishable: true,
          predictionEnabled: false,
        },
        {
          id: 'product-a',
          canonicalName: 'Milk A',
          aliases: [],
          category: null,
          typicalUnit: null,
          productType: null,
          isPerishable: false,
          predictionEnabled: true,
        },
      ],
    });
  });
});
