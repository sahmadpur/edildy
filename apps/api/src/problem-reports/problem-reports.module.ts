import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { ProblemReportMediaController } from './problem-report-media.controller';
import { ProblemReportMediaService } from './problem-report-media.service';
import { ProblemReportQueries } from './problem-report-queries';
import { ProblemReportScope } from './problem-report-scope';
import { ProblemReportsController } from './problem-reports.controller';
import { ProblemReportsService } from './problem-reports.service';
import { ProblemReportSync } from './problem-report-sync';

/** Problem reports (2026-11-06 design §6): standalone problems workers report from the phone. */
@Module({
  imports: [SchedulingModule],
  controllers: [ProblemReportsController, ProblemReportMediaController],
  providers: [ProblemReportScope, ProblemReportQueries, ProblemReportsService, ProblemReportMediaService, ProblemReportSync],
  exports: [ProblemReportScope, ProblemReportQueries, ProblemReportSync],
})
export class ProblemReportsModule {}
