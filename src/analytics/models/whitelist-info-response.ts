import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

export class WhitelistInfoResponse {
  @ApiProperty({ type: String })
  @IsString()
  id: string;
  @ApiProperty({ type: String, required: false })
  @IsString()
  name?: string;
  @ApiProperty({ type: String, required: false })
  @IsString()
  publicLink?: string;
  @ApiProperty({ type: Boolean, required: true })
  @IsBoolean()
  registrationActive: boolean
}