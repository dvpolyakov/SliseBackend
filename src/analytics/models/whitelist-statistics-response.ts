import { DiscordResponse } from './discord-response';
import { TokenBalance } from './token-info';

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
  floorPrice?: number;
  total_supply?: number;
  mintPrice?: number;
  numOwners?: number;
  oneDayVolume?: number;
  oneDayChange?: number;
  oneDaySales?: number;
  oneDayAveragePrice?: number;
  sevenDayVolume?: number;
  sevenDayChange?: number;
  sevenDaySales?: number;
  sevenDayAveragePrice?: number;
  thirtyDayVolume?: number;
  thirtyDayChange?: number;
  thirtyDaySales?: number;
  thirtyDayAveragePrice?: number;
  totalVolume?: number;
  totalSales?: number;
  totalMinted?: number;
  averagePrice?: number;
  marketCap?: number;
  floorPriceHistoricOneDay?: number;
  floorPriceHistoricSevenDay?: number;
  floorPriceHistoricThirtyDay?: number;
  updatedDate?: string;
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