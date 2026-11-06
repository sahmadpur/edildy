import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { ProblemReportQueries } from './problem-report-queries';
import { ProblemReportScope } from './problem-report-scope';
import { ProblemReportsController } from './problem-reports.controller';
import { ProblemReportsService } from './problem-reports.service';

/** Problem reports (2026-11-06 design §6): standalone problems workers report from the phone. */
@Module({
  imports: [SchedulingModule],
  controllers: [ProblemReportsController],
  providers: [ProblemReportScope, ProblemReportQueries, ProblemReportsService],
  exports: [ProblemReportScope, ProblemReportQueries],
})
export class ProblemReportsModule {}
