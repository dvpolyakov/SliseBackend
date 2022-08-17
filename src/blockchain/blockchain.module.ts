import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BlockchainService } from './blockchain.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
    }),
    PrismaModule,
  ],
  exports: [BlockchainService],
  providers: [BlockchainService],
})
export class BlockchainModule {}
