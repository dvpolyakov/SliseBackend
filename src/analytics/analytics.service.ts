import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { WhitelistInfoRequest } from './requests/whitelist-info-request';
import { WhitelistInfoResponse } from './models/whitelist-info-response';
import {
  AlsoHold,
  CollectionInfoResponse,
  MutualHoldingsResponse,
  TargetingResponse,
  TopHoldersDashboardResponse,
  TopHoldersResponse,
  WhitelistStatisticsResponse
} from './models/whitelist-statistics-response';
import { PersistentStorageService } from '../persistentstorage/persistentstorage.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { IntegraionService } from '../integration/integration.service';
import { mapChainType } from '../common/utils/token-mapper';
import { WHITELISTS_KEY_NAME } from '../common/utils/redis-consts';
import { JwtPayload } from '../auth/models/payload';
import { GenerateLinkRequest } from '../auth/requests/generate-link-request';
import { UrlGeneratorService } from 'nestjs-url-generator';
import { WhiteListPreviewResponse } from './responses/whitelist-preview-response';
import { WhitelistSettingsResponse } from './responses/whitelist-settings-response';
import { WhitelistSettingsRequest } from './requests/whitelist-settings-request';

const CACHE_EXPRIRE = 60 * 10;
const ENS_ADDRESS = '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85';
const QUERY_LIMIT = 30;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly covalentApiKey = process.env.COVALENT_API_KEY;
  private readonly bitqueryApiKey = process.env.BITQUERY_API_KEY;
  private readonly NFTPORT_API_KEY = process.env.NFTPORT_API_KEY;
  private readonly EtherscanApi = require('etherscan-api').init(
    process.env.ETHERESCAN_API_KEY
  );
  private readonly Moralis = require('moralis/node');
  private readonly web3 = require('web3');
  private readonly hashMap: Map<string, string>;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    /*  @InjectQueue('waitlist') private readonly holdersQueue: Queue,*/
    private readonly storage: PersistentStorageService,
    private readonly blockchainService: BlockchainService,
    private readonly integrationService: IntegraionService,
    private readonly urlGeneratorService: UrlGeneratorService
  ) {
    this.web3 = new this.web3(
      new this.web3.providers.HttpProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
      )
    );
    this.hashMap = new Map<string, string>();
  }

  public async test(): Promise<any> {
    const a = await this.blockchainService.test();
    return a;
  }

  public async getTargets(vector: number): Promise<number> {
    const result = await this.prisma.$queryRaw<any>`select count(*) from "TargetingHolders" where vector <= cast(${vector}::text as double precision)`;
    return result[0].count;
  }

  public async exportTargets(vector: number): Promise<TargetingResponse> {
    const result = await this.prisma.$queryRaw<any>`select address from "TargetingHolders" 
    inner join "TokenHolder" TH on TH.id = "TargetingHolders"."holderId" 
    where vector <= cast(${vector}::text as double precision)`;

    return {
      address: result
    };
  }

  public async getWhitelistStatistics(whitelistId: string): Promise<WhitelistStatisticsResponse> {
    /*const existTopHolders = await this.redis.get(`whitelistStatistics ${whitelistId}`);*/
    /* if (existTopHolders) {
       return JSON.parse(existTopHolders);
     } else {*/
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId
      },
      include: {
        whitelistInfo: true
      }
    })
    const [twitterFollowersCount, discordInfo]
      = await Promise.all([
      this.integrationService.getTwitterFollowersCount(whitelist.whitelistInfo.twitter),
      this.integrationService.getDiscordInfo(whitelist.whitelistInfo.discord)
    ]);

    const [whales, bluechips, whitelistSize] = await Promise.all([
      await this.prisma.$queryRaw<number>`
        select count(*) from "WhitelistMember"
        inner join "AccountBalance" AB on "WhitelistMember".id = AB."whitelistMemberId"
        where AB."usdBalance" >= cast(${2000000}::text as double precision) and "whitelistId" = ${whitelistId}`,
      await this.prisma.$queryRaw<number>`
        select count(*) from "WhitelistMember"
        where "WhitelistMember"."totalTokens" >= cast(${10}::text as double precision) and "whitelistId" = ${whitelistId}`,
      await this.prisma.whitelistMember.count({
        where: {
          whitelistId: whitelistId
        }
      })
    ]);

    const existMutualHolders = await this.redis.get(`${whitelistId} mutualHolders`);
    let mutualHoldings: MutualHoldingsResponse[];
    if (existMutualHolders)
      mutualHoldings = JSON.parse(existMutualHolders);
    else
      mutualHoldings = await this.mutualHoldings(whitelistId);

    if (mutualHoldings.length > 30) {
      await this.redis.set(`${whitelistId} mutualHoldings`, JSON.stringify(mutualHoldings), 'EX', CACHE_EXPRIRE);
    }

    const existTopHolders = await this.redis.get(`${whitelistId} mutualHoldings`);
    let topHolders: TopHoldersResponse[];
    if(existTopHolders)
      topHolders = JSON.parse(existTopHolders);
    else
      topHolders = await this.topHolders(whitelistId);

    const topHoldersDashboard: TopHoldersDashboardResponse = {
      topHolders: topHolders,
      bots: 10,
      bluechipHolders: bluechips[0].count,
      whales: whales[0].count,
      size: whitelistSize
    }

    const response: WhitelistStatisticsResponse = {
      bluechipHolders: bluechips[0].count,
      bots: 10,
      discordInfo: discordInfo,
      twitterFollowersCount: twitterFollowersCount,
      whales: whales[0].count,
      whitelistSize: whitelistSize,
      topHolders: topHolders,
      mutualHoldings: mutualHoldings
    }

    return response;
    /* }*/
  }

  public async regenerateLink(request: GenerateLinkRequest, owner: JwtPayload): Promise<string> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: request.whitelistId
      },
      include: {
        whitelistLink: true
      }
    });

    if (whitelist.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    const addedSymbols = this.makeHash(4);
    const collectionName = this.splitCollectionName(whitelist.name);
    const link = `${collectionName}-${addedSymbols}`;

    if (whitelist.whitelistLink) {
      await this.prisma.whitelistLink.update({
        where: {
          link: whitelist.whitelistLink.link
        },
        data: {
          link: link
        }
      })
    }
    return link;
  }

  public async storeClearWhitelist(whitelistRequest: WhitelistInfoRequest, owner: JwtPayload): Promise<WhitelistInfoResponse> {
    this.logger.debug(`whitelist: ${whitelistRequest.collectionName} received`);
    const addedSymbols = this.makeHash(4);
    const collectionName = this.splitCollectionName(whitelistRequest.collectionName);
    const link = `${collectionName}-${addedSymbols}`;

    const whitelist = await this.prisma.whitelist.create({
      data: {
        ownerId: owner.address,
        name: whitelistRequest.collectionName,
        chainType: mapChainType(whitelistRequest.networkType),
        size: 0,
        settings: {
          create: {
            discordVerification: false,
            minTwitterFollowers: 0,
            minWalletBalance: 0,
            totalSize: 10000,
            registrationActive: false,
            twitterVerification: false
          }
        },
        whitelistInfo: {
          create: {
            description: null,
            discord: null,
            discordMembers: null,
            logo: null,
            mintDate: null,
            mintPrice: null,
            registrationEndDate: null,
            twitter: null,
            twitterFollowers: null,
            urlSlug: null,
            url: null,
          }
        },
        whitelistLink: {
          create: {
            link: link
          }
        }
      }
    });

    await this.redis.sadd(WHITELISTS_KEY_NAME, whitelist.id);
    this.logger.debug(`whitelist: ${whitelistRequest.collectionName} stored`);
    return {
      name: whitelist.name,
      id: whitelist.id,
      publicLink: link,
      registrationActive: false
    };
  }

  public async getWhitelistInfoByLink(link: string): Promise<WhiteListPreviewResponse> {
    const whitelistLink = await this.prisma.whitelistLink.findUnique({
      where: {
        link: link
      },
      include: {
        whitelist: {
          include: {
            whitelistInfo: true
          }
        }
      }
    });

    if (!whitelistLink.whitelist.whitelistInfo)
      throw new HttpException('Whitelist not found', HttpStatus.BAD_REQUEST);

    return {
      whitelistName: whitelistLink.whitelist.name,
      description: whitelistLink.whitelist.whitelistInfo.description,
      discord: whitelistLink.whitelist.whitelistInfo.discord,
      discordMembers: whitelistLink.whitelist.whitelistInfo.discordMembers,
      logo: whitelistLink.whitelist.whitelistInfo.logo,
      mintDate: whitelistLink.whitelist.whitelistInfo.mintDate,
      mintPrice: whitelistLink.whitelist.whitelistInfo.mintPrice,
      registrationEndDate: whitelistLink.whitelist.whitelistInfo.registrationEndDate,
      twitter: whitelistLink.whitelist.whitelistInfo.twitter,
      twitterFollowers: whitelistLink.whitelist.whitelistInfo.twitterFollowers,
      urlSlug: whitelistLink.whitelist.whitelistInfo.urlSlug,
      url: whitelistLink.whitelist.whitelistInfo.url,
    }
  }

  public async getWhitelistSettings(whitelistId: string, owner: JwtPayload): Promise<WhitelistSettingsResponse> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId
      },
      include: {
        settings: true
      }
    });

    if (whitelist.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    return {
      discordVerification: whitelist.settings.discordVerification,
      minWalletBalance: whitelist.settings.minWalletBalance,
      totalSize: whitelist.settings.totalSize,
      minTwitterFollowers: whitelist.settings.minTwitterFollowers,
      registrationActive: whitelist.settings.registrationActive,
      twitterVerification: whitelist.settings.twitterVerification,
    }
  }

  public async updateWhitelistSettings(whitelistId: string, request: WhitelistSettingsRequest, owner: JwtPayload): Promise<WhitelistSettingsResponse> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId
      },
      include: {
        settings: true
      }
    });

    if (whitelist.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    const updatedWhitelistSettings = await this.prisma.registrationSettings.update({
      where: {
        whitelistId: whitelist.id
      },
      data: {
        discordVerification: request.discordVerification,
        minWalletBalance: request.minWalletBalance,
        totalSize: request.totalSize,
        minTwitterFollowers: request.minTwitterFollowers,
        registrationActive: request.registrationActive,
        twitterVerification: request.twitterVerification,
      }
    });

    return {
      discordVerification: updatedWhitelistSettings.discordVerification,
      minWalletBalance: updatedWhitelistSettings.minWalletBalance,
      totalSize: updatedWhitelistSettings.totalSize,
      minTwitterFollowers: updatedWhitelistSettings.minTwitterFollowers,
      registrationActive: updatedWhitelistSettings.registrationActive,
      twitterVerification: updatedWhitelistSettings.twitterVerification,
    }
  }

  private makeHash(length): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() *
        charactersLength));
    }
    return result;
  }

  private splitCollectionName(name: string): string {
    const collectionNameWords = name.split(' ');
    return collectionNameWords.map((w) => {
      const symb = w[0].toUpperCase();
      return symb + w.substring(1, w.length);
    }).join('');
  }

  private async mutualHoldings(whitelistId: string): Promise<MutualHoldingsResponse[]> {
    const mutualHoldings = await this.prisma.$queryRaw<MutualHoldingsResponse[]>`
        select "Token"."contractAddress" as address, "Token"."contractName", count("Token"."contractAddress") as totalHoldings from "Token"
        inner join "WhitelistMember" WM on WM.id = "Token"."whitelistMemberId"
        where WM."whitelistId" = ${whitelistId} and "Token"."tokenType" <> 'ERC20' and "Token"."contractAddress" <> ${ENS_ADDRESS}
        group by "Token"."contractAddress", "Token"."contractName"
        order by totalHoldings desc
        limit ${QUERY_LIMIT};`;
    await Promise.all(mutualHoldings.map(async (holding) => {
      const token = await this.prisma.token.findFirst({
        where: {
          contractAddress: holding.address
        }
      });

      const logo = token.logo ?? token.items[0]?.image;
      holding.holdings = {
        totalSupply: token.totalSupply ?? token.total_supply ?? 0,
        logo: logo,
        floorPrice: token.floorPrice,
        numOwners: token.numOwners
      }
    }));

    mutualHoldings.sort((a, b) => {
      return b.totalholdings - a.totalholdings;
    });

    let initPercent = 100;
    let initValue: number;
    mutualHoldings.map((holding, idx) => {
      if (idx === 0) {
        initValue = holding.totalholdings;
        holding.percent = initPercent;
      } else {
        holding.percent = ((holding.totalholdings / initValue) * initPercent);
      }
    });

    return mutualHoldings;
  }

  private async topHolders(whitelistId: string): Promise<TopHoldersResponse[]> {
    const topHolders = await this.prisma.$queryRaw<TopHoldersResponse[]>`
        select "WhitelistMember".id, "WhitelistMember".address, AB."usdBalance" as portfolio, "WhitelistMember"."totalTokens" as nfts from "WhitelistMember"
        inner join "AccountBalance" AB on "WhitelistMember".id = AB."whitelistMemberId"
        where "WhitelistMember"."whitelistId" = ${whitelistId} 
        order by AB."usdBalance" desc 
        limit ${QUERY_LIMIT};`;

    let initPercent = 100;
    let initValue: number;

    topHolders.map(async (holder) => {
      if (holder.portfolio >= 2000000) {
        holder.label = 'whale';
      } else {
        holder.label = 'mixed';
      }
      holder.avgNFTPrice = holder.portfolio / holder.nfts;
      if (holder.nfts > 20 && holder.nfts < 30) {
        holder.holdingTimeLabel = 'mixed'
      } else if (holder.nfts > 30) {
        holder.holdingTimeLabel = 'holder'
      } else {
        holder.holdingTimeLabel = 'flipper'
      }
      holder.tradingVolume = holder.portfolio - holder.avgNFTPrice;
      const tokens = await this.prisma.token.findMany({
        where: {
          whitelistMemberId: holder.id,
          logo: {
            not: null
          }
        },
        take: 3,
      });
      const collections: CollectionInfoResponse[] = tokens.map((token) => {
        return {
          logo: token.logo
        }
      });
      const alsoHold: AlsoHold = {
        total: holder.nfts - tokens.length,
        collectionInfo: collections
      };
      holder.alsoHold = alsoHold;
    });
    topHolders.sort((a, b) => {
      return b.avgNFTPrice - a.avgNFTPrice;
    });

    topHolders.map((holder, idx) => {
      if (idx === 0) {
        initValue = holder.avgNFTPrice;
        holder.percent = initPercent;
      } else {
        holder.percent = ((holder.avgNFTPrice / initValue) * initPercent);
      }
    });
    return topHolders;
  }
}