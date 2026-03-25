import { Brand } from '@prisma/client';

export interface ILandingPageStrategy {
  getData(brand: Brand | null): Promise<unknown>;
}
