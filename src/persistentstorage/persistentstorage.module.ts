import { Module } from '@nestjs/common';
import { PersistentStorageService } from './persistentstorage.service';

@Module({
  providers: [PersistentStorageService],
  exports: [PersistentStorageService]
})
export class PersistentStorageModule {}
