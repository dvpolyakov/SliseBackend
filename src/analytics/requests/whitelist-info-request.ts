import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { NetworkType } from '../../common/enums/network-type';

export class WhitelistInfoRequest {
  @ApiProperty({ type: String })
  @IsString()
  collectionName: string;

  @ApiProperty({
    enum: NetworkType,
    isArray: false,
    example: NetworkType.Ethereum,
  })
  @IsEnum(NetworkType)
  networkType: NetworkType;
}
