import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule.register({
    timeout: 50000,
    maxRedirects: 5,
  })],
  exports: [BlockchainService],
  providers: [BlockchainService],
})
export class BlockchainModule {}
