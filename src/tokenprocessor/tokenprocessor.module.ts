import { Module, OnModuleInit } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TokenProcessorService } from './tokenprocessor.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AnalyticsModule, PrismaModule],
  providers: [TokenProcessorService],
  exports: [TokenProcessorService]
})
export class TokenProcessorModule implements OnModuleInit {
  onModuleInit() {
    console.log('PROCESSOR ', process.pid);
  }
}