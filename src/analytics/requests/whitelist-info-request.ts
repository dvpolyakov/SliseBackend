import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';

export class WhitelistInfoRequest {
  @ApiProperty({ type: String })
  @IsString()
  collectionName: string;
}