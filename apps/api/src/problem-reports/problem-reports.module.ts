import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { ProblemReportScope } from './problem-report-scope';

/** Problem reports (2026-11-06 design §6): standalone problems workers report from the phone. */
@Module({
  imports: [SchedulingModule],
  controllers: [],
  providers: [ProblemReportScope],
  exports: [ProblemReportScope],
})
export class ProblemReportsModule {}
