import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GenerateLinkRequest {
  @ApiProperty({ type: String })
  @IsString()
  whitelistId: string;
}