import { ApiProperty } from '@nestjs/swagger';

export class TokenItem {
  @ApiProperty()
  contract_decimals: number;
  @ApiProperty()
  contract_name: string;
  @ApiProperty()
  contract_ticker_symbol: string;
  @ApiProperty()
  contract_address: string;
  @ApiProperty()
  supports_erc?: any;
  @ApiProperty()
  logo_url: string;
  @ApiProperty()
  address: string;
  @ApiProperty()
  balance: string;
  @ApiProperty()
  total_supply: string;
  @ApiProperty()
  block_height: number;
}

export class Pagination {
  @ApiProperty()
  has_more: boolean;
  @ApiProperty()
  page_number: number;
  @ApiProperty()
  page_size: number;
  @ApiProperty()
  total_count?: any;
}

export class TokenHoldersResponse {
  @ApiProperty()
  updated_at: string;
  @ApiProperty({ type: [TokenItem] })
  items: TokenItem[];
  @ApiProperty()
  pagination: Pagination;
}

export class TokenHolder {
  @ApiProperty()
  address: string;
  @ApiProperty()
  amount: number;
  @ApiProperty()
  first_transfer: number;
  @ApiProperty()
  total_balance_usd: number;
}

export class TimestampEvent {
  @ApiProperty()
  totalSuply: number;
  @ApiProperty()
  totalAmount: number;
  @ApiProperty()
  totalHolders: number;
  @ApiProperty()
  timestamp: string;
}

export class Balance {
  @ApiProperty()
  value: bigint;
  @ApiProperty()
  currency: Currency;
}

export class HolderInfo {
  @ApiProperty({ type: [Balance] })
  balances: Balance[];
  @ApiProperty()
  address: string;
}

export class Currency {
  @ApiProperty()
  tokenId: string;
  @ApiProperty()
  tokenType: TokenType;
  @ApiProperty()
  address: string;
  @ApiProperty()
  symbol: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  decimals: number;
}

export enum TokenType {
  Empty = '-',
  Erc20 = 'ERC20',
  Erc223 = 'ERC223',
  Erc721 = 'ERC721',
  Erc827 = 'ERC827',
  Erc1155 = 'ERC1155',
  TokenType = '',
}
