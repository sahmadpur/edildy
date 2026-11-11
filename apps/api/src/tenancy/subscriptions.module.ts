import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { SubscriptionJobs } from './subscription-jobs';

@Module({ imports: [SchedulingModule], providers: [SubscriptionJobs], exports: [SubscriptionJobs] })
export class SubscriptionsModule {}
