import { Module } from '@nestjs/common';
import { WarmupService } from '../warmup/warmup.service';

@Module({
  providers: [WarmupService],
  exports: [WarmupService]
})
export class WarmupModule {}
