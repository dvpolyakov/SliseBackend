import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
    }),
  ],
  exports: [BlockchainService],
  providers: [BlockchainService],
})
export class BlockchainModule {}
