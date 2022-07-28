import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { IntegraionService } from '../integration/integration.service';

@Module({
  imports: [HttpModule.register({
    timeout: 50000,
    maxRedirects: 5,
  })],
  providers: [IntegraionService],
  exports: [IntegraionService]
})
export class IntegrationModule {}
