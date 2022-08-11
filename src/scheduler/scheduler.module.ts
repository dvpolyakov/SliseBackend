import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SchedulerService } from './scheduler.service';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [BullModule.registerQueue({
    name: 'whitelist',
  }), HttpModule, AnalyticsModule, PrismaModule],
  providers: [SchedulerService],
  exports: [SchedulerService]
})
export class SchedulerModule {
}
