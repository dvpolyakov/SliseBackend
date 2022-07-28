import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';

export class AuthWhitelistMember {
  @ApiProperty({ type: String })
  @IsString()
  address: string;

  @ApiProperty({ type: String })
  @IsString()
  whitelistId: string;
}