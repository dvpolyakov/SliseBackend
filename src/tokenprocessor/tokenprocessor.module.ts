import { Module, OnModuleInit } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TokenProcessorService } from './tokenprocessor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [AnalyticsModule, PrismaModule, BlockchainModule],
  providers: [TokenProcessorService],
  exports: [TokenProcessorService]
})
export class TokenProcessorModule implements OnModuleInit {
  onModuleInit() {
  }
}