import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { NetworkType } from '../../common/enums/network-type';

export class AuthUserRequest {
  @ApiProperty({ type: String })
  @IsString()
  @Transform((address) => address.value.toLowerCase())
  address: string;

  @ApiProperty({
    enum: NetworkType,
    isArray: false,
    example: NetworkType.Ethereum,
  })
  @IsEnum(NetworkType)
  networkType: NetworkType;
}
