import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import {
  HolderInfo,
  TimestampEvent,
  TokenHolder as TokenHolderInternal,
  TokenHoldersResponse
} from './models/token-holders';
import { BalanceResponse } from './models/balances';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { BlockChainEvent, BlockChainUserEvent } from './models/blockchain-events';
import { WhitelistInfoRequest } from './requests/whitelist-info-request';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WhitelistInfoResponse } from './models/whitelist-info-response';
import {
  CollectionInfoResponse,
  CollectionStats,
  TargetingResponse,
  TopHoldersDashboardResponse
} from './models/whitelist-statistics-response';
import { PersistentStorageService } from '../persistentstorage/persistentstorage.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import papaparse from 'papaparse';
import { TokenBalance } from './models/token-info';
import { IntegraionService } from '../integration/integration.service';
import { mapChainType, mapTokenChainType } from '../common/utils/token-mapper';
import { AuthWhitelistMember } from '../auth/requests/auth-whitelistmember-request';
import { ETH_QUEUE_KEY_NAME, SOL_QUEUE_KEY_NAME, WHITELISTS_KEY_NAME } from '../common/utils/redis-consts';
import { NetworkType } from '../common/enums/network-type';
import { JwtPayload } from '../auth/models/payload';
import { GenerateLinkRequest } from '../auth/requests/generate-link-request';
import { UrlGeneratorService } from 'nestjs-url-generator';
import { WhiteListPreviewResponse } from './responses/whitelist-preview-response';
import { WhitelistSettingsResponse } from './responses/whitelist-settings-response';
import { WhitelistSettingsRequest } from './requests/whitelist-settings-request';

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
    @InjectQueue('waitlist') private readonly holdersQueue: Queue,
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
            registrationActive: true,
            twitterVerification: false
          }
        },
        whitelistInfo: {
          create:{
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
}