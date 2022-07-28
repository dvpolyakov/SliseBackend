import { Module } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@nestjs-modules/ioredis';

@Module({
  imports: [HttpModule.register({
    timeout: 60000,
  })],
  exports: [BlockchainService],
  providers: [BlockchainService],
})
export class BlockchainModule {}
