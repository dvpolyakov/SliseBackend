import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BullModule } from '@nestjs/bull';
import { PersistentStorageModule } from '../persistentstorage/persistentstorage.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { IntegrationModule } from '../integration/integration.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BullModule.registerQueue({
    name: 'waitlist',
  }), PrismaModule, HttpModule.register({
    timeout: 50000,
    maxRedirects: 5,
  }), 
  PersistentStorageModule,
  BlockchainModule,
  IntegrationModule,
  AuthModule],
  providers: [AnalyticsService, AnalyticsController],
  exports: [AnalyticsService, AnalyticsController]
})
export class AnalyticsModule {
}
