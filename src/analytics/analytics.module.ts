import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PersistentStorageModule } from '../persistentstorage/persistentstorage.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'whitelist',
    }),
    PrismaModule,
    HttpModule.register({
      timeout: 50000,
      maxRedirects: 5,
    }),
    PersistentStorageModule,
    BlockchainModule,
    IntegrationModule,
  ],
  providers: [AnalyticsService, AnalyticsController],
  exports: [AnalyticsService, AnalyticsController],
})
export class AnalyticsModule {}
