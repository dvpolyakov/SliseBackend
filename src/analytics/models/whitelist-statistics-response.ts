import { DiscordResponse } from './discord-response';

export class TopHoldersResponse {
  id: string;
  address: string;
  nfts: number;
  portfolio: number;
  label: string;
  avgNFTPrice: number;
  alsoHold: AlsoHold;
  nftsTotalPrice: number;
  holdingTimeLabel: string;
  tradingVolume: number;
}

export class TopHoldersDashboardResponse {
  topHolders: TopHoldersResponse[];
  bots: number;
  whales: number;
  bluechipHolders: number;
  size: number;
}

export class MutualHoldingsResponse {
  address: string;
  name: string;
  totalholdings: number;
  totalHolders: number;
  percent: number
  holdings?: CollectionInfoResponse;
}

export class AlsoHold {
  collectionInfo?: CollectionInfoResponse[];
  total?: number;
}

export class CollectionInfoResponse {
  totalSupply?: number;
  logo?: string;
  stats?: CollectionStats;
}
export class CollectionStats {
  floor_price: number;
  total_supply: number;
  mint_price: number;
  num_owners: number;
  one_day_volume: number;
  one_day_change: number;
  one_day_sales: number;
  one_day_average_price: number;
  seven_day_volume: number;
  seven_day_change: number;
  seven_day_sales: number;
  seven_day_average_price: number;
  thirty_day_volume: number;
  thirty_day_change: number;
  thirty_day_sales: number;
  thirty_day_average_price: number;
  total_volume: number;
  total_sales: number;
  total_minted: number;
  average_price: number;
  market_cap: number;
  floor_price_historic_one_day: number;
  floor_price_historic_seven_day: number;
  floor_price_historic_thirty_day: number;
  updated_date: string;
}

export class WhitelistStatisticsResponse {
  whitelistSize: number;
  twitterFollowersCount?: number;
  discordInfo?: DiscordResponse;
  bluechipHolders: number;
  whales: number;
  bots: number;
  topHolders: TopHoldersResponse[];
  mutualHoldings: MutualHoldingsResponse[];
}

export class WhitelistResponse {
  address: number;
  holdings: CollectionInfoResponse[];
  nfts: number;
  avgNFTsPrice: number;
  balance: number;
  portfolio: number;
  label: string;
  bluechipHolders: number;
  whales: number;
  bots: number;
  twitter?: string;
  discord?: string;
}

export class TargetingResponse {
  address?: string[]
}