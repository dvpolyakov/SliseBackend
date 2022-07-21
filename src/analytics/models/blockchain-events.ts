import { ApiProperty } from '@nestjs/swagger';

export class BlockChainEvent {
  @ApiProperty()
  txHash: string;
  @ApiProperty()
  txFrom: string;
  @ApiProperty()
  txTo: string;
  @ApiProperty()
  timestamp: string;
  @ApiProperty()
  eventName: string;
  @ApiProperty()
  eventFrom: string;
  @ApiProperty()
  metadata: string;
  @ApiProperty()
  eventType: string;
  @ApiProperty()
  smartContractAddress: string;
}

export class BlockChainUserEvent {
  @ApiProperty()
  address: string;
  @ApiProperty()
  amount: number;
  @ApiProperty()
  total_balance_usd: number;
  @ApiProperty()
  events: BlockChainEvent[];
  @ApiProperty()
  total: number;
}