import { ProgramCategory } from '@prisma/client';

export interface ILandingPageStrategy {
  getData(programCategory: ProgramCategory | null): Promise<any>;
}
