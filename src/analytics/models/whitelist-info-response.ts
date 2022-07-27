import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class WhitelistInfoResponse {
  @ApiProperty({ type: String })
  @IsString()
  id: string;
  @ApiProperty({ type: String, required: false })
  @IsString()
  name?: string;
}