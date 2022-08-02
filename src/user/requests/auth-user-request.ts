import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { NetworkType } from '../../enums/network-type';

export class AuthUserRequest {
  @ApiProperty({ type: String })
  @IsString()
  address: string;

  @ApiProperty({
    enum: NetworkType,
    isArray: false,
    example: NetworkType.Ethereum,
  })
  @IsEnum(NetworkType)
  networkType: NetworkType;
}