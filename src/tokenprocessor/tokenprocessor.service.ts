import { Logger, Scope } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { ChainType, TokenType } from '@prisma/client';
import pLimit from 'p-limit';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { mapTokenType } from '../common/utils/token-mapper';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
  ETH_QUEUE_KEY_NAME,
  MATIC_QUEUE_KEY_NAME,
  SOL_QUEUE_KEY_NAME,
} from '../common/utils/redis-consts';
import { TokenBalance } from '../analytics/models/token-info';
import { CollectionInfoResponse } from '../analytics/models/whitelist-statistics-response';

const CONCURRENT_WORKERS = 2;

@Processor({ name: 'whitelist', scope: Scope.DEFAULT })
export class TokenProcessorService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {}

  private readonly logger = new Logger(TokenProcessorService.name);

  @Process({ name: ETH_QUEUE_KEY_NAME, concurrency: 1 })
  async processWhitelistMemberEth(job: Job) {
    this.logger.debug(`received job with id: ${job.id}`);
    const { jobRequest } = job.data;
    this.logger.debug(
      `processing whitelist member address ${jobRequest.address}`,
    );
    const tokenBalance = await this.blockchainService.getNFTsEthereum(
      jobRequest.address,
    );
    const accountBalance = await this.blockchainService.getAccountBalanceEth(
      jobRequest.address,
    );
    const totalNFTs = tokenBalance.reduce(
      (accumulator, item) => accumulator + item.balance,
      0,
    );

    await this.prisma.$transaction(async () => {
      const whitelistMember = await this.prisma.whitelistMember.update({
        where: {
          id: jobRequest.whitelistMemberId,
        },
        data: {
          totalTokens: totalNFTs,
          whitelistId: jobRequest.whitelistId,
        },
      });
      await this.prisma.accountBalance.create({
        data: {
          whitelistMemberId: whitelistMember.id,
          tokenBalance: accountBalance.tokenBalance,
          usdBalance: accountBalance.usdBalance,
          chainType: ChainType.ETHEREUM,
        },
      });
      const limit = pLimit(CONCURRENT_WORKERS);
      let fetchedTokens: any[] = [];
      const jobs: any[] = [];
      tokenBalance.map((token) =>
        jobs.push(
          limit(() =>
            this.processEvmToken(whitelistMember.id, token, 'ethereum'),
          ),
        ),
      );
      fetchedTokens = await Promise.all(jobs);
      this.logger.debug(
        `processed ${fetchedTokens.length} tokens for ${whitelistMember.id}`,
      );

      await this.prisma.token.createMany({
        data: fetchedTokens,
      });

      // await Promise.all(fetchedTokens.map(async (token) => {
      //   await this.prisma.token.create({
      //     data: token
      //   });
      // }));

      if (!(fetchedTokens.length > 0)) {
        this.logger.debug(`no tokens for ${whitelistMember.address}`);
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id,
          },
          data: {
            tokenProcessed: false,
            tokenProcessedAttemps: whitelistMember.tokenProcessedAttemps + 1,
          },
        });
      } else {
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id,
          },
          data: {
            tokenProcessed: true,
          },
        });
      }
      this.logger.debug(`${jobRequest.address} stored`);
    });
  }

  @Process({ name: MATIC_QUEUE_KEY_NAME, concurrency: 1 })
  async processWhitelistMemberMatic(job: Job) {
    this.logger.debug(`received job with id: ${job.id}`);
    const { jobRequest } = job.data;
    this.logger.debug(
      `processing whitelist member address ${jobRequest.address}`,
    );
    const tokenBalance = await this.blockchainService.getNFTsPolygon(
      jobRequest.address,
    );
    const accountBalance =
      await this.blockchainService.getAccountBalancePolygon(jobRequest.address);
    const totalNFTs = tokenBalance.reduce(
      (accumulator, item) => accumulator + item.balance,
      0,
    );

    await this.prisma.$transaction(async () => {
      const whitelistMember = await this.prisma.whitelistMember.update({
        where: {
          id: jobRequest.whitelistMemberId,
        },
        data: {
          totalTokens: totalNFTs,
          whitelistId: jobRequest.whitelistId,
        },
      });
      await this.prisma.accountBalance.create({
        data: {
          whitelistMemberId: whitelistMember.id,
          tokenBalance: accountBalance.tokenBalance,
          usdBalance: accountBalance.usdBalance,
          chainType: ChainType.ETHEREUM,
        },
      });
      const limit = pLimit(CONCURRENT_WORKERS);
      let fetchedTokens: any[] = [];
      const jobs: any[] = [];
      tokenBalance.map((token) =>
        jobs.push(
          limit(() =>
            this.processEvmToken(whitelistMember.id, token, 'polygon'),
          ),
        ),
      );
      fetchedTokens = await Promise.all(jobs);
      this.logger.debug(
        `processed ${fetchedTokens.length} tokens for ${whitelistMember.id}`,
      );

      await this.prisma.token.createMany({
        data: fetchedTokens,
      });

      // await Promise.all(fetchedTokens.map(async (token) => {
      //   await this.prisma.token.create({
      //     data: token
      //   });
      // }));

      if (!(fetchedTokens.length > 0)) {
        this.logger.debug(`no tokens for ${whitelistMember.address}`);
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id,
          },
          data: {
            tokenProcessed: false,
            tokenProcessedAttemps: whitelistMember.tokenProcessedAttemps + 1,
          },
        });
      } else {
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id,
          },
          data: {
            tokenProcessed: true,
          },
        });
      }
      this.logger.debug(`${jobRequest.address} stored`);
    });
  }

  private async processEvmToken(
    whitelistMemberId: string,
    token: TokenBalance,
    chain: string,
  ): Promise<any> {
    let collectionInfo: CollectionInfoResponse = null;
    try {
      collectionInfo = await this.blockchainService.getCollectionInfo(
        token.contractAddress,
        chain,
      );

      /* if(!collectionInfo?.logo){
         collectionInfo = {
           logo : token.nfts[0]?.image
         }
       } */
    } catch (e) {
      this.logger.debug(e.toString());
    }
    return {
      contractAddress: token.contractAddress,
      balance: token.balance,
      contractName: token.contractName,
      nftDescription: token.nftDescription,
      nftVersion: token.nftVersion,
      tokenType: mapTokenType(token.tokenType.toUpperCase()),
      whitelistMemberId,
      items: JSON.stringify(token.nfts),
      ...collectionInfo,
    };
  }

  @Process({ name: SOL_QUEUE_KEY_NAME, concurrency: 1 })
  async processWhitelistMemberSol(job: Job) {
    this.logger.debug(`received job with id: ${job.id}`);
    const { jobRequest } = job.data;
    this.logger.debug(
      `processing whitelist member address ${jobRequest.address}`,
    );
    const tokenBalance = await this.blockchainService.getNFTsSolana(
      jobRequest.address,
    );
    const accountBalance = await this.blockchainService.getAccountBalanceSol(
      jobRequest.address,
    );
    const totalNFTs = tokenBalance.reduce(
      (accumulator, item) => accumulator + item.balance,
      0,
    );

    await this.prisma.$transaction(async () => {
      const whitelistMember = await this.prisma.whitelistMember.update({
        where: {
          id: jobRequest.whitelistMemberId,
        },
        data: {
          totalTokens: totalNFTs,
          whitelistId: jobRequest.whitelistId,
        },
      });
      await this.prisma.accountBalance.create({
        data: {
          whitelistMemberId: whitelistMember.id,
          tokenBalance: accountBalance.tokenBalance,
          usdBalance: accountBalance.usdBalance,
          chainType: ChainType.SOLANA,
        },
      });
      const fetchedTokens = tokenBalance.map((token) => {
        return {
          contractAddress: token.contractAddress || '',
          balance: token.balance || 0,
          contractName: token.contractName || '',
          nftDescription: token.nftDescription || '',
          nftVersion: token.nftVersion,
          tokenType: TokenType.UNKOWN,
          whitelistMemberId: whitelistMember.id,
          items: JSON.stringify(token.nfts),
          floorPrice: null,
          total_supply: 0,
          mintPrice: 0,
          numOwners: null,
          averagePrice: null,
          floorPriceHistoricOneDay: null,
          floorPriceHistoricSevenDay: null,
          floorPriceHistoricThirtyDay: null,
          marketCap: null,
          oneDayAveragePrice: null,
          oneDayChange: null,
          oneDaySales: null,
          oneDayVolume: null,
          sevenDayAveragePrice: null,
          sevenDayChange: null,
          sevenDaySales: null,
          sevenDayVolume: null,
          thirtyDayAveragePrice: null,
          thirtyDayChange: null,
          thirtyDaySales: null,
          thirtyDayVolume: null,
          totalMinted: null,
          totalSales: null,
          totalVolume: null,
          updatedDate: null,
        };
      });
      await this.prisma.token.createMany({
        data: fetchedTokens,
      });

      this.logger.debug(
        `processed ${fetchedTokens.length} tokens for ${whitelistMember.id}`,
      );

      if (!(fetchedTokens.length > 0)) {
        this.logger.debug(`no tokens for ${whitelistMember.address}`);
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id,
          },
          data: {
            tokenProcessed: false,
            tokenProcessedAttemps: whitelistMember.tokenProcessedAttemps + 1,
          },
        });
      } else {
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id,
          },
          data: {
            tokenProcessed: true,
          },
        });
      }
      this.logger.debug(`${jobRequest.address} stored`);
    });
  }
}
