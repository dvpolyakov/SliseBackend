import { Module, OnModuleInit } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AnalyticsController } from './analytics/analytics.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { TokenProcessorModule } from './tokenprocessor/tokenprocessor.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PersistentStorageModule } from './persistentstorage/persistentstorage.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { WarmupModule } from './warmup/warmup.module';
import { IntegrationModule } from './integration/integration.module';
import { UserModule } from './user/user.module';
import { UrlGeneratorModule } from 'nestjs-url-generator';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [AuthModule, AnalyticsModule, PrismaModule, RedisModule.forRoot({
    config: {
      url: process.env.REDIS_URL,
      connectTimeout: 20000,
      tls: {
        rejectUnauthorized: false
      }
    }
  }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_QUEUE_HOST,
        port: process.env.REDIS_QUEUE_PORT,
        password: process.env.REDIS_QUEUE_PASSWORD,
        connectTimeout: 20000,
        tls: {
          rejectUnauthorized: false
        }
      }
    }),
    SchedulerModule, ScheduleModule.forRoot(),
    TokenProcessorModule,
    MulterModule.register(),
    PersistentStorageModule,
    BlockchainModule,
    WarmupModule,
    IntegrationModule,
    UserModule,
    UrlGeneratorModule.forRoot({
      secret: process.env.LINK_SECRET,
      appUrl: process.env.APP_URL,
    }),
  ],
  controllers: [AppController, AnalyticsController, AuthController],
  providers: [AppService, AnalyticsModule, AuthController]
})
export class AppModule implements OnModuleInit {
  onModuleInit() {

  }
}
