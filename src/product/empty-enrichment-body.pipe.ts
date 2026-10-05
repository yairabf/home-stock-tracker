import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { z } from 'zod';
const emptyBody = z.object({}).strict().optional();

@Injectable()
export class EmptyEnrichmentBodyPipe implements PipeTransform<
  unknown,
  undefined
> {
  transform(value: unknown): undefined {
    if (!emptyBody.safeParse(value).success)
      throw new BadRequestException(
        'Product enrichment accepts only an empty body',
      );
    return undefined;
  }
}
