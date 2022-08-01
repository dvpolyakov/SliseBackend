import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { NetworkType } from '../../enums/network-type';

export class AuthWhitelistMember {
  @ApiProperty({ type: String })
  @Length(42)
  @IsString()
  @Transform((address) => address.value.toLowerCase())
  address: string;

  @ApiProperty({ type: String })
  @IsString()
  whitelistId: string;

  @ApiProperty({
    enum: NetworkType,
    isArray: false,
    example: NetworkType.Ethereum,
  })
  @IsEnum(NetworkType)
  networkType: NetworkType;
}