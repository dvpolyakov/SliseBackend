import { Module } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@nestjs-modules/ioredis';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HttpModule.register({
    timeout: 60000,
  }), PrismaModule],
  exports: [BlockchainService],
  providers: [BlockchainService],
})
export class BlockchainModule {}
