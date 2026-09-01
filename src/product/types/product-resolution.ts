import { z } from 'zod';
import { ProductType } from '../../generated/prisma/enums';
import {
  normalizeProductDisplayName,
  normalizeProductName,
} from '../product-name.util';
import type { ProductSearchProduct } from './product-search';

export const PRODUCT_RESOLUTION_MIN_CONFIDENCE = 0.7;
export const PRODUCT_RESOLUTION_TIMEOUT_MS = 10_000;
export const PRODUCT_RESOLUTION_MAX_CONTEXT_BYTES = 16_384;
export const PRODUCT_RESOLUTION_MAX_NAME_LENGTH = 200;
export const PRODUCT_RESOLUTION_MAX_CATEGORY_LENGTH = 100;
export const PRODUCT_RESOLUTION_MAX_UNIT_LENGTH = 50;
export const PRODUCT_RESOLUTION_MAX_REASON_LENGTH = 500;
export const PRODUCT_RESOLUTION_MAX_ID_LENGTH = 200;
export const PRODUCT_RESOLUTION_MAX_ALIASES = 10;
export const PRODUCT_RESOLUTION_MAX_CANDIDATES = 20;
export const PRODUCT_RESOLUTION_PROMPT_VERSION = 'product-resolution-v1';

const boundedDisplayName = z
  .string()
  .transform(normalizeProductDisplayName)
  .pipe(
    z
      .string()
      .min(1)
      .refine(
        (value) => [...value].length <= PRODUCT_RESOLUTION_MAX_NAME_LENGTH,
      ),
  );

const boundedString = (max: number) =>
  z
    .string()
    .transform(normalizeProductDisplayName)
    .pipe(
      z
        .string()
        .min(1)
        .refine((value) => [...value].length <= max),
    );

const confidence = z.number().finite().min(0).max(1);
const reason = boundedString(PRODUCT_RESOLUTION_MAX_REASON_LENGTH);

export const productResolutionCandidateSchema = z
  .object({
    id: z.string().min(1).max(PRODUCT_RESOLUTION_MAX_ID_LENGTH),
    canonicalName: boundedDisplayName,
    aliases: z.array(boundedDisplayName),
    category: boundedString(PRODUCT_RESOLUTION_MAX_CATEGORY_LENGTH).nullable(),
    typicalUnit: boundedString(PRODUCT_RESOLUTION_MAX_UNIT_LENGTH).nullable(),
    productType: z.enum(ProductType).nullable(),
    isPerishable: z.boolean(),
  })
  .strict();

export const productResolutionContextSchema = z
  .object({
    requestedPhrase: boundedDisplayName.transform(normalizeProductName),
    candidates: z
      .array(productResolutionCandidateSchema)
      .max(PRODUCT_RESOLUTION_MAX_CANDIDATES),
  })
  .strict();

const createProductProposalSchema = z
  .object({
    recommendation: z.literal('create_product'),
    newProduct: z
      .object({
        canonicalName: boundedDisplayName,
        aliases: z
          .array(boundedDisplayName)
          .max(PRODUCT_RESOLUTION_MAX_ALIASES),
        category: boundedString(PRODUCT_RESOLUTION_MAX_CATEGORY_LENGTH),
        typicalUnit: boundedString(
          PRODUCT_RESOLUTION_MAX_UNIT_LENGTH,
        ).nullable(),
        productType: z.enum(ProductType),
        isPerishable: z.boolean(),
      })
      .strict(),
    confidence,
    reason,
  })
  .strict()
  .superRefine(({ newProduct }, context) => {
    const canonicalName = normalizeProductName(newProduct.canonicalName);
    const aliases = newProduct.aliases.map(normalizeProductName);
    if (aliases.includes(canonicalName)) {
      context.addIssue({
        code: 'custom',
        path: ['newProduct', 'aliases'],
        message: 'Aliases must not duplicate the canonical name',
      });
    }
    if (new Set(aliases).size !== aliases.length) {
      context.addIssue({
        code: 'custom',
        path: ['newProduct', 'aliases'],
        message: 'Aliases must be unique',
      });
    }
  });

const addAliasProposalSchema = z
  .object({
    recommendation: z.literal('add_alias'),
    targetProductId: z.string().min(1).max(PRODUCT_RESOLUTION_MAX_ID_LENGTH),
    alias: boundedDisplayName,
    confidence,
    reason,
  })
  .strict();

const askUserToChooseProposalSchema = z
  .object({
    recommendation: z.literal('ask_user_to_choose'),
    candidateProductIds: z
      .array(z.string().min(1).max(PRODUCT_RESOLUTION_MAX_ID_LENGTH))
      .min(2)
      .max(PRODUCT_RESOLUTION_MAX_CANDIDATES)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Candidate product IDs must be unique',
      }),
    confidence,
    reason,
  })
  .strict();

export const productResolutionProposalSchema = z.discriminatedUnion(
  'recommendation',
  [
    createProductProposalSchema,
    addAliasProposalSchema,
    askUserToChooseProposalSchema,
  ],
);

export type ProductResolutionContext = z.output<
  typeof productResolutionContextSchema
>;
export type ProductResolutionProposal = z.output<
  typeof productResolutionProposalSchema
>;

export interface ProductResolutionResult {
  exactMatch: ProductSearchProduct | null;
  candidates: ProductSearchProduct[];
  proposal: ProductResolutionProposal | null;
}
