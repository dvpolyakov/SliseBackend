import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BullModule } from '@nestjs/bull';
import { join } from 'path';

@Module({
  imports: [BullModule.registerQueue({
    name: 'waitlist',
  }), PrismaModule, HttpModule.register({
    timeout: 8000,
    maxRedirects: 5,
  })],
  providers: [AnalyticsService, AnalyticsController],
  exports: [AnalyticsService, AnalyticsController]
})
export class AnalyticsModule {
}
