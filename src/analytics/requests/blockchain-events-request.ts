import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BlockChainEventRequest {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @Transform(({ value }) => value.split(','))
  @ApiProperty({ type: [String] })
  contractsAddresses: string[];
  @ArrayMinSize(1)
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => value.split(','))
  @ApiProperty({ type: [String] })
  addresses: string[];
}