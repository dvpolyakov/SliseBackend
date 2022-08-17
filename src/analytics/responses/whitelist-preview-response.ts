import { NetworkType } from '../../common/enums/network-type';

export class WhitelistPreviewResponse {
  whitelistName: string;

  logo?: string;

  mintPrice?: number;

  mintDate?: Date;

  blockchain: NetworkType;

  twitter?: string;

  discord?: string;

  description?: string;

  registrationActive: boolean;

  totalSupply: number;

  minBalance: number;

  minTwitterFollowers: number;

  twitterRequired: boolean;

  discordRequired: boolean;

  twitterMinFollowersRequired: boolean;
}
