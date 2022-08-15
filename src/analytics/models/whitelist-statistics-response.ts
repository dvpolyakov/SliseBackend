import { DiscordResponse } from './discord-response';
import { NetworkType } from '../../common/enums/network-type';

export class TopHoldersResponse {
  id: string;
  address: string;
  nfts: number;
  portfolio: number;
  label: string;
  avgNFTPrice: number;
  percent: number
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
  blockchain: NetworkType;
  topHolders: TopHoldersResponse[];
  mutualHoldings: MutualHoldingsResponse[];
}

export class BaseStatisticsResponse {
  whitelistSize: number;
  bluechipHolders: number;
  whales: number;
  bots: number;
}

export class TargetingResponse {
  address?: string[]
}