import {
  closeProblemReportSchema,
  createProblemReportSchema,
  pageOf,
  problemReportDtoSchema,
  problemReportListQuerySchema,
  problemReportMediaRegisterSchema,
  reportSiteSchema,
} from '@taskop/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class CreateProblemReportDto extends createZodDto(createProblemReportSchema) {}
export class CloseProblemReportDto extends createZodDto(closeProblemReportSchema) {}
export class ProblemReportMediaRegisterDto extends createZodDto(problemReportMediaRegisterSchema) {}
export class ProblemReportListQueryDto extends createZodDto(problemReportListQuerySchema) {}
export class ProblemReportResponse extends createZodDto(problemReportDtoSchema) {}
export class ProblemReportPageResponse extends createZodDto(pageOf(problemReportDtoSchema)) {}
export class ReportSitesResponse extends createZodDto(z.array(reportSiteSchema)) {}
