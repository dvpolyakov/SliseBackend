import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WarmupService } from '../warmup/warmup.service';

@Module({
  imports: [HttpModule],
  providers: [WarmupService],
  exports: [WarmupService]
})
export class WarmupModule {}
