import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { init } from 'etherscan-api';
import { PrismaService } from '../prisma/prisma.service';
import { WhitelistInfoRequest } from './requests/whitelist-info-request';
import { WhitelistInfoResponse } from './models/whitelist-info-response';
import {
  BaseStatisticsResponse,
  CollectionInfoResponse,
  MutualHoldingsResponse,
  MutualHoldingsResponseModel,
  TargetingResponse,
  TopHoldersDashboardResponse,
  TopHoldersResponse,
  WhitelistStatisticsResponse,
} from './models/whitelist-statistics-response';
import { PersistentStorageService } from '../persistentstorage/persistentstorage.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { IntegraionService } from '../integration/integration.service';
import { mapChainType, mapTokenChainType } from '../common/utils/token-mapper';
import { WHITELISTS_KEY_NAME } from '../common/utils/redis-consts';
import { JwtPayload } from '../auth/models/payload';
import { GenerateLinkRequest } from '../auth/requests/generate-link-request';
import { WhitelistPreviewResponse } from './responses/whitelist-preview-response';
import { WhitelistSettingsResponse } from './responses/whitelist-settings-response';
import { WhitelistSettingsRequest } from './requests/whitelist-settings-request';
import { TokenData } from './models/token-info';
import { WhitelistResponse } from './responses/whitelist-response';
import { targetingHolders } from '../common/targeting-holders';
import { makeRandomWord } from '../common/utils/hashmaker';
import {
  ProjectInfoResponse,
  ProjectInfoRequest,
} from './requests/project-info-request';
import { NetworkType } from '../common/enums/network-type';

const CACHE_EXPIRE = 60 * 10;
const ENS_ADDRESS = '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85';
const QUERY_LIMIT = 30;
const MIN_FOR_CACHE = 15;

// TODO: IPFS link support
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  private readonly covalentApiKey = process.env.COVALENT_API_KEY;

  private readonly bitqueryApiKey = process.env.BITQUERY_API_KEY;

  private readonly NFTPORT_API_KEY = process.env.NFTPORT_API_KEY;

  private readonly EtherscanApi = init(process.env.ETHERESCAN_API_KEY);

  private readonly Moralis = require('moralis/node');

  private readonly Web3 = require('web3');

  private readonly hashMap: Map<string, string>;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly storage: PersistentStorageService,
    private readonly blockchainService: BlockchainService,
    private readonly integrationService: IntegraionService,
  ) {
    this.Web3 = new this.Web3(
      new this.Web3.providers.HttpProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`,
      ),
    );
    this.hashMap = new Map<string, string>();
  }

  public async test(id: string): Promise<any> {
    const tokens = await this.prisma.token.findMany({
      where: {
        items: {
          array_contains: ['ipfs'],
        },
      },
    });

    /* await Promise.all(
      tokens.map(async (token) => {
        const def = token.logo.substring(token.logo.lastIndexOf('/'));
        const logo = `https://ipfs.io/ipfs${def}`;
        await this.prisma.token.update({
          where: {
            id: token.id,
          },
          data: {
            logo,
          },
        });
      }),
    ); */
    return tokens.length;
  }

  public async solBalance(address: string): Promise<number> {
    return this.blockchainService.solBalance(address);
  }

  public async getTargets(vector: number): Promise<any> {
    const result = targetingHolders.filter((holder) => {
      return holder.vector < vector;
    });
    return {
      total: result.length,
    };
  }

  public async exportTargets(vector: number): Promise<TargetingResponse> {
    const result = targetingHolders.filter((holder) => {
      return holder.vector < vector;
    });

    const data = result.map((res) => {
      return res.address;
    });

    return {
      address: data,
    };
  }

  public async getTwitterFollowersCount(account: string): Promise<number> {
    return this.integrationService.getTwitterFollowersCountByUsername(account);
  }

  public async getWhitelists(owner: JwtPayload): Promise<WhitelistResponse[]> {
    const whitelists = await this.prisma.whitelist.findMany({
      where: {
        ownerId: owner.address,
      },
      include: {
        whitelistInfo: true,
        whitelistLink: true,
      },
    });
    return whitelists.map((wl) => {
      return {
        id: wl.id,
        name: wl.name,
        networkType: mapTokenChainType(wl.chainType),
        logo: wl.whitelistInfo.logo,
        link: wl.whitelistLink.link,
      };
    });
  }

  /*  private idMapper(whitelistId: string): any {
      let wl;
      switch (whitelistId) {
        case '1':
          wl = JSON.parse(IKIGAI);
          break;
        default:
          break;
      }
      return wl;
    } */

  public async getWhitelistStatistics(
    whitelistId: string,
    owner: JwtPayload,
  ): Promise<WhitelistStatisticsResponse> {
    this.logger.debug(`whitelists statistics ${whitelistId}`);
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId,
      },
      include: {
        whitelistInfo: true,
      },
    });
    if (whitelist?.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    const existWhitelistStatistics = await this.redis.get(
      `${whitelistId} whitelistStatistics`,
    );
    if (existWhitelistStatistics) {
      return JSON.parse(existWhitelistStatistics);
    }
    const [twitterFollowersCount, discordInfo] = await Promise.all([
      this.integrationService.getTwitterFollowersCount(
        whitelist.whitelistInfo.twitter,
      ),
      this.integrationService.getDiscordInfo(whitelist.whitelistInfo.discord),
    ]);
    const baseStatistics = await this.baseWhitelistStatistics(whitelistId);

    const existMutualHolders = await this.redis.get(
      `${whitelistId} mutualHolders`,
    );
    let mutualHoldings: MutualHoldingsResponse[];
    if (existMutualHolders) mutualHoldings = JSON.parse(existMutualHolders);
    else mutualHoldings = await this.mutualHoldings(whitelistId);

    if (mutualHoldings.length >= MIN_FOR_CACHE) {
      await this.redis.set(
        `${whitelistId} mutualHoldings`,
        JSON.stringify(mutualHoldings),
        'EX',
        CACHE_EXPIRE,
      );
    }

    const existTopHolders = await this.redis.get(
      `${whitelistId} topHolders portfolio`,
    );
    let topHoldersDashboard: TopHoldersDashboardResponse;
    if (existTopHolders) topHoldersDashboard = JSON.parse(existTopHolders);
    else
      topHoldersDashboard = {
        topHolders: await this.topHolders(
          whitelistId,
          true,
          mapTokenChainType(whitelist.chainType),
        ),
        bots: baseStatistics.bots,
        bluechipHolders: baseStatistics.bluechipHolders,
        whales: baseStatistics.whales,
        size: baseStatistics.whitelistSize,
      };

    if (topHoldersDashboard.topHolders.length >= MIN_FOR_CACHE) {
      await this.redis.set(
        `${whitelistId} topHolders portfolio`,
        JSON.stringify(topHoldersDashboard),
        'EX',
        CACHE_EXPIRE,
      );
    }

    const response: WhitelistStatisticsResponse = {
      bots: baseStatistics.bots,
      discordInfo,
      twitterFollowersCount,
      bluechipHolders: baseStatistics.bluechipHolders,
      whales: baseStatistics.whales,
      whitelistSize: baseStatistics.whitelistSize,
      topHolders: topHoldersDashboard.topHolders,
      mutualHoldings,
      blockchain: mapTokenChainType(whitelist.chainType),
    };

    if (topHoldersDashboard.topHolders.length >= MIN_FOR_CACHE) {
      await this.redis.set(
        `${whitelistId} whitelistStatistics`,
        JSON.stringify(response),
        'EX',
        CACHE_EXPIRE,
      );
    }
    return response;
  }

  public async getMutualHoldings(
    whitelistId: string,
    owner: JwtPayload,
  ): Promise<MutualHoldingsResponseModel> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId,
      },
    });

    if (whitelist?.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    const existMutualHolders = await this.redis.get(
      `${whitelistId} mutualHolders`,
    );
    let mutualHoldings: MutualHoldingsResponseModel;
    if (existMutualHolders)
      mutualHoldings = {
        blockchain: mapTokenChainType(whitelist.chainType),
        mutualHoldings: JSON.parse(existMutualHolders),
      };
    else
      mutualHoldings = {
        blockchain: mapTokenChainType(whitelist.chainType),
        mutualHoldings: await this.mutualHoldings(whitelistId),
      };

    return mutualHoldings;
  }

  public async getTopHolders(
    whitelistId: string,
    owner: JwtPayload,
  ): Promise<TopHoldersDashboardResponse> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId,
      },
    });

    if (whitelist?.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    const existTopHolders = await this.redis.get(`${whitelistId} topHolders`);
    let topHoldersDashboard: TopHoldersDashboardResponse;
    if (existTopHolders) topHoldersDashboard = JSON.parse(existTopHolders);
    else {
      const baseStatistics = await this.baseWhitelistStatistics(whitelistId);
      topHoldersDashboard = {
        topHolders: await this.topHolders(
          whitelistId,
          false,
          mapTokenChainType(whitelist.chainType),
        ),
        bots: baseStatistics.bots,
        bluechipHolders: baseStatistics.bluechipHolders,
        whales: baseStatistics.whales,
        size: baseStatistics.whitelistSize,
      };
    }
    return topHoldersDashboard;
  }

  public async regenerateLink(
    request: GenerateLinkRequest,
    owner: JwtPayload,
  ): Promise<string> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: request.whitelistId,
      },
      include: {
        whitelistLink: true,
      },
    });

    if (whitelist?.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    const addedSymbols = makeRandomWord(4);
    const collectionName = this.splitCollectionName(whitelist.name);
    const link = `${collectionName}-${addedSymbols}`;

    if (whitelist.whitelistLink) {
      await this.prisma.whitelistLink.update({
        where: {
          link: whitelist.whitelistLink.link,
        },
        data: {
          link,
        },
      });
    }
    return link;
  }

  public async storeClearWhitelist(
    whitelistRequest: WhitelistInfoRequest,
    owner: JwtPayload,
  ): Promise<WhitelistInfoResponse> {
    this.logger.debug(`whitelist: ${whitelistRequest.collectionName} received`);
    const collectionName = this.splitCollectionName(
      whitelistRequest.collectionName,
    );
    const addedSymbols = makeRandomWord(4);
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
            minWalletBalance: 0.0,
            twitterVerification: false,
          },
        },
        whitelistInfo: {
          create: {
            description: null,
            discord: null,
            discordMembers: null,
            logo: null,
            mintDate: null,
            mintPrice: 0.01,
            twitter: null,
            twitterFollowers: null,
            url: null,
            totalSupply: 10000,
          },
        },
        whitelistLink: {
          create: {
            link,
          },
        },
      },
    });

    await this.redis.sadd(WHITELISTS_KEY_NAME, whitelist.id);
    this.logger.debug(`whitelist: ${whitelistRequest.collectionName} stored`);
    return {
      name: whitelist.name,
      id: whitelist.id,
      publicLink: link,
      registrationActive: false,
    };
  }

  public async getWhitelistInfoByLink(
    link: string,
  ): Promise<WhitelistPreviewResponse> {
    const whitelistLink = await this.prisma.whitelistLink.findUnique({
      where: {
        link,
      },
      include: {
        whitelist: {
          include: {
            whitelistInfo: true,
            settings: true,
          },
        },
      },
    });

    if (!whitelistLink)
      throw new HttpException('Whitelist not found', HttpStatus.NOT_FOUND);

    return {
      whitelistName: whitelistLink.whitelist.name,
      description: whitelistLink.whitelist.whitelistInfo.description,
      discord: whitelistLink.whitelist.whitelistInfo.discord,
      logo: whitelistLink.whitelist.whitelistInfo.logo,
      mintDate: whitelistLink.whitelist.whitelistInfo.mintDate,
      mintPrice: whitelistLink.whitelist.whitelistInfo.mintPrice,
      twitter: whitelistLink.whitelist.whitelistInfo.twitter,
      blockchain: mapTokenChainType(whitelistLink.whitelist.chainType),
      registrationActive:
        whitelistLink.whitelist.whitelistInfo.registrationActive,
      totalSupply: whitelistLink.whitelist.whitelistInfo.totalSupply,
      minBalance: whitelistLink.whitelist.settings.minWalletBalance,
      minTwitterFollowers: whitelistLink.whitelist.settings.minTwitterFollowers,
      discordRequired: whitelistLink.whitelist.settings.discordVerification,
      twitterMinFollowersRequired:
        whitelistLink.whitelist.settings.requireMinTwitterFollowers,
      twitterRequired: whitelistLink.whitelist.settings.twitterVerification,
    };
  }

  public async getWhitelistInfo(
    whitelistId: string,
    owner: JwtPayload,
  ): Promise<ProjectInfoResponse> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId,
      },
      include: {
        whitelistInfo: true,
        whitelistLink: true,
      },
    });

    if (whitelist?.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    return {
      description: whitelist.whitelistInfo.description,
      discord: whitelist.whitelistInfo.discord,
      blockchain: mapTokenChainType(whitelist.chainType),
      mintPrice: whitelist.whitelistInfo.mintPrice,
      collectionName: whitelist.name,
      totalSupply: whitelist.whitelistInfo.totalSupply,
      registrationActive: whitelist.whitelistInfo.registrationActive,
      twitter: whitelist.whitelistInfo.twitter,
      mintDate: whitelist.whitelistInfo.mintDate,
      logo: whitelist.whitelistInfo.logo,
      link: whitelist.whitelistLink.link,
    };
  }

  public async updateWhitelistInfo(
    whitelistId: string,
    request: ProjectInfoRequest,
    owner: JwtPayload,
    file?: Express.Multer.File,
  ): Promise<ProjectInfoResponse> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId,
      },
      include: {
        whitelistInfo: true,
        whitelistLink: true,
      },
    });

    if (whitelist?.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    let uploadedFile;
    if (file) {
      try {
        uploadedFile = await this.storage.uploadImage(file);
      } catch (e) {
        this.logger.debug(`error uploading file ${e.toString()}`);
      }
    }
    const uploadModel = {
      twitter: request.twitter || null,
      discord: request.discord || null,
      mintDate: new Date(request.mintDate) || null,
      mintPrice: +request.mintPrice || null,
      description: request.description || null,
      totalSupply: +request.totalSupply || null,
      registrationActive: request.registrationActive.toString() === 'true',
      logo: '',
    };

    if (uploadedFile) uploadModel.logo = uploadedFile;

    const updatedWlInfo = await this.prisma.whitelistInfo.update({
      where: {
        whitelistId,
      },
      data: uploadModel,
    });
    let link: string;
    if (whitelist.name !== request.collectionName) {
      await this.prisma.whitelistLink.delete({
        where: {
          link: whitelist.whitelistLink.link,
        },
      });
      const newCollectionName = this.splitCollectionName(
        request.collectionName,
      );
      const addedSymbols = makeRandomWord(4);
      link = `${newCollectionName || makeRandomWord(3)}-${addedSymbols}`;
      await this.prisma.whitelistLink.create({
        data: {
          whitelistId: whitelist.id,
          link,
        },
      });
    }

    link = link || whitelist.whitelistLink.link;

    const updatedWl = await this.prisma.whitelist.update({
      where: {
        id: whitelistId,
      },
      data: {
        name: request.collectionName,
        chainType: mapChainType(request.blockchain),
      },
    });

    return {
      description: updatedWlInfo.description,
      discord: updatedWlInfo.discord,
      blockchain: mapTokenChainType(updatedWl.chainType),
      mintPrice: updatedWlInfo.mintPrice,
      collectionName: updatedWl.name,
      totalSupply: updatedWlInfo.totalSupply,
      registrationActive: updatedWlInfo.registrationActive,
      twitter: updatedWlInfo.twitter,
      mintDate: updatedWlInfo.mintDate,
      logo: updatedWlInfo.logo,
      link,
    };
  }

  public async getWhitelistSettings(
    whitelistId: string,
    owner: JwtPayload,
  ): Promise<WhitelistSettingsResponse> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId,
      },
      include: {
        settings: true,
      },
    });

    if (whitelist?.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    return {
      discordVerification: whitelist.settings.discordVerification,
      minWalletBalance: whitelist.settings.minWalletBalance,
      minTwitterFollowers: whitelist.settings.minTwitterFollowers,
      twitterVerification: whitelist.settings.twitterVerification,
      balanceVerification: whitelist.settings.balanceVerification,
      requireMinTwitterFollowers: whitelist.settings.requireMinTwitterFollowers,
    };
  }

  public async updateWhitelistSettings(
    whitelistId: string,
    request: WhitelistSettingsRequest,
    owner: JwtPayload,
  ): Promise<WhitelistSettingsResponse> {
    const whitelist = await this.prisma.whitelist.findUnique({
      where: {
        id: whitelistId,
      },
      include: {
        settings: true,
      },
    });

    if (whitelist?.ownerId !== owner.address)
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    const updatedWhitelistSettings =
      await this.prisma.registrationSettings.update({
        where: {
          whitelistId: whitelist.id,
        },
        data: {
          discordVerification:
            request.discordVerification.toString() === 'true',
          minWalletBalance: request.minWalletBalance,
          minTwitterFollowers: request.minTwitterFollowers,
          twitterVerification:
            request.twitterVerification.toString() === 'true',
          balanceVerification: request.balanceVerification,
          requireMinTwitterFollowers: request.requireMinTwitterFollowers,
        },
      });

    return {
      discordVerification: updatedWhitelistSettings.discordVerification,
      minWalletBalance: updatedWhitelistSettings.minWalletBalance,
      minTwitterFollowers: updatedWhitelistSettings.minTwitterFollowers,
      twitterVerification: updatedWhitelistSettings.twitterVerification,
      balanceVerification: whitelist.settings.balanceVerification,
      requireMinTwitterFollowers: whitelist.settings.requireMinTwitterFollowers,
    };
  }

  private splitCollectionName(name: string): string {
    const collectionNameWords = name.split(' ');
    return collectionNameWords
      .map((w) => {
        const symb = w[0].toUpperCase();
        return symb + w.substring(1, w.length);
      })
      .join('');
  }

  private async mutualHoldings(
    whitelistId: string,
  ): Promise<MutualHoldingsResponse[]> {
    let mutualHoldings: MutualHoldingsResponse[] = [];
    try {
      mutualHoldings = await this.prisma.$queryRaw<MutualHoldingsResponse[]>`
        select "Token"."contractAddress" as address, "Token"."contractName", count("Token"."contractAddress") as totalHoldings from "Token"
        inner join "WhitelistMember" WM on WM.id = "Token"."whitelistMemberId"
        where WM."whitelistId" = ${whitelistId} and "Token"."tokenType" <> 'ERC20' and "Token"."contractAddress" not in (${ENS_ADDRESS})
        group by "Token"."contractAddress", "Token"."contractName"
        order by totalHoldings desc
        limit ${QUERY_LIMIT};`;

      // TODO: Probably change searching collections to getting first 3 nfts
      await Promise.all(
        mutualHoldings.map(async (holding) => {
          let token = await this.prisma.token.findFirst({
            where: {
              contractAddress: holding.address,
              totalSupply: {
                not: null,
              },
            },
          });
          if (!token) {
            token = await this.prisma.token.findFirst({
              where: {
                contractAddress: holding.address,
              },
            });
          }
          const balances: TokenData[] = JSON.parse(token.items.toString());
          const logo = token.logo ?? balances[0]?.image;
          holding.holdings = {
            totalSupply: token.totalSupply ?? token.total_supply ?? 0,
            logo,
            floorPrice: token.floorPrice,
            numOwners: token.numOwners,
          };
        }),
      );

      mutualHoldings.sort((a, b) => {
        return b.totalholdings - a.totalholdings;
      });

      const initPercent = 100;
      let initValue: number;
      mutualHoldings.forEach((holding, idx) => {
        if (idx === 0) {
          initValue = holding.totalholdings;
          holding.percent = initPercent;
        } else {
          holding.percent = (holding.totalholdings / initValue) * initPercent;
        }
      });
    } catch (e) {
      this.logger.debug(
        `error fetching mutual holders for whitelist ${whitelistId}`,
      );
    }

    return mutualHoldings;
  }

  private async topHolders(
    whitelistId: string,
    key: boolean,
    networkType: NetworkType,
  ): Promise<TopHoldersResponse[]> {
    // TODO: Fix it!
    let multiplicator;
    switch (networkType) {
      case NetworkType.Ethereum:
        multiplicator = +(await this.redis.get('ethUsdPrice'));
        break;
      case NetworkType.Polygon:
        multiplicator = +(await this.redis.get('maticUsdPrice'));
        break;
      case NetworkType.Solana:
        multiplicator = +(await this.redis.get('solUsdPrice'));
        break;
      default:
        multiplicator = 1;
        break;
    }
    let topHolders: TopHoldersResponse[] = [];
    try {
      topHolders = await this.prisma.$queryRaw<TopHoldersResponse[]>`
        select DISTINCT "WhitelistMember".id, "WhitelistMember".address, AB."tokenBalance" as portfolio, "WhitelistMember"."totalTokens" as nfts, WMI.discord, WMI.twitter, WMI."twitterFollowers" from "WhitelistMember"
        inner join "AccountBalance" AB on "WhitelistMember".id = AB."whitelistMemberId"
        inner join "WhitelistMemberInfo" WMI on "WhitelistMember".id = WMI."whitelistMemberId"
        where "WhitelistMember"."whitelistId" = ${whitelistId}  and "WhitelistMember"."totalTokens" > cast(${0}::text as integer)
        order by portfolio desc 
        limit ${QUERY_LIMIT};`;

      const initPercent = 100;
      let initValue: number;

      await Promise.all(
        topHolders.map(async (holder) => {
          holder.portfolio *= multiplicator;
          if (holder.portfolio >= 2_000_000) {
            holder.label = 'whale';
          } else {
            holder.label = 'mixed';
          }
          holder.avgNFTPrice = holder.portfolio / holder.nfts;
          if (holder.nfts > 20 && holder.nfts < 30) {
            holder.holdingTimeLabel = 'mixed';
          } else if (holder.nfts > 30) {
            holder.holdingTimeLabel = 'holder';
          } else {
            holder.holdingTimeLabel = 'flipper';
          }
          holder.tradingVolume = holder.portfolio - holder.avgNFTPrice;
          const tokens = await this.prisma.token.findMany({
            where: {
              whitelistMemberId: holder.id,
              logo: {
                not: null,
              },
            },
            take: 3,
          });
          // TODO: sometimes null
          const collections: CollectionInfoResponse[] = tokens.map((token) => {
            const balances: TokenData[] = JSON.parse(token.items.toString());
            const logo = token.logo ?? (balances[0]?.image || '');
            return {
              logo,
            };
          });
          if (!collections || collections?.filter((x) => x.logo).length < 3) {
            const nfts: TokenData[] = JSON.parse(tokens[0].items.toString());
            collections
              .filter((x) => x.logo == null)
              .forEach((cl) => {
                cl.logo = nfts[Math.random() * nfts.length]?.image || '';
              });
            /* collections = nfts.slice(0, 3).map((nft) => {
            return {
              logo: nft.image
            }
          }) */
          }
          holder.alsoHold = {
            total: holder.nfts - tokens.length,
            collectionInfo: collections,
          };
        }),
      );
      topHolders.sort((a, b) => {
        return b.avgNFTPrice - a.avgNFTPrice;
      });

      topHolders.forEach((holder, idx) => {
        if (idx === 0) {
          initValue = holder.avgNFTPrice;
          holder.percent = initPercent;
        } else {
          holder.percent = (holder.avgNFTPrice / initValue) * initPercent;
        }
      });

      if (key)
        topHolders.sort((a, b) => {
          return b.portfolio - a.portfolio;
        });
    } catch (e) {
      this.logger.debug(
        `error fetching top holders for whitelist ${whitelistId}`,
      );
    }

    return topHolders;
  }

  private async baseWhitelistStatistics(
    whitelistId: string,
  ): Promise<BaseStatisticsResponse> {
    // TODO: cache this variables
    const [whales, bluechips, whitelistSize, bots] = await Promise.all([
      this.prisma.$queryRaw<number>`
        select count(*) from "WhitelistMember"
        inner join "AccountBalance" AB on "WhitelistMember".id = AB."whitelistMemberId"
        where AB."usdBalance" >= cast(${2000000}::text as double precision) and "whitelistId" = ${whitelistId}`,
      this.prisma.$queryRaw<number>`
        select count(*) from "WhitelistMember"
        where "WhitelistMember"."totalTokens" >= cast(${10}::text as double precision) and "whitelistId" = ${whitelistId}`,
      this.prisma.whitelistMember.count({
        where: {
          whitelistId,
        },
      }),
      this.prisma.whitelistMember.count({
        where: {
          whitelistId,
          totalTokens: {
            equals: 0,
          },
          tokenProcessed: true,
          AccountBalance: {
            some: {
              usdBalance: {
                gt: 0,
              },
            },
          },
        },
      }),
    ]);

    return {
      bluechipHolders: bluechips[0].count,
      whales: whales[0].count,
      whitelistSize,
      bots,
    };
  }
}
