import { Logger, Scope } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { ChainType } from '@prisma/client'
import { mapTokenType } from '../common/utils/token-mapper';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ETH_QUEUE_KEY_NAME, SOL_QUEUE_KEY_NAME } from '../common/utils/redis-consts';
import { TokenBalance, TokenData } from '../analytics/models/token-info';
import pLimit from 'p-limit';
import { CollectionInfoResponse } from '../analytics/models/whitelist-statistics-response';

const CONCURRENT_WORKERS = 2;

@Processor({ name: 'whitelist', scope: Scope.DEFAULT })
export class TokenProcessorService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService
  ) {
  }

  private readonly logger = new Logger(TokenProcessorService.name);

  @Process({ name: ETH_QUEUE_KEY_NAME, concurrency: 1 })
  async processWhitelistMemberEth(job: Job) {
    this.logger.debug(`received job with id: ${job.id}`);
    const jobRequest = job.data.jobRequest;
    this.logger.debug(`processing whitelist member address ${jobRequest.address}`)
    const tokenBalance = await this.blockchainService.getNFTsEthereum(jobRequest.address);
    const accountBalance = await this.blockchainService.getAccountBalanceEth(jobRequest.address);
    const totalNFTs = tokenBalance.reduce((accumulator, item) => accumulator + item.balance, 0);

    await this.prisma.$transaction(async () => {
      const whitelistMember = await this.prisma.whitelistMember.update({
        where: {
          id: jobRequest.whitelistMemberId
        },
        data: {
          totalTokens: totalNFTs,
          whitelistId: jobRequest.whitelistId,
        }
      });
      await this.prisma.accountBalance.create({
        data: {
          whitelistMemberId: whitelistMember.id,
          tokenBalance: accountBalance.tokenBalance,
          usdBalance: accountBalance.usdBalance,
          chainType: ChainType.ETHEREUM
        }
      });
      const limit = pLimit(CONCURRENT_WORKERS);
      let fetchedTokens: any[] = [];
      let jobs: any[] = [];
      tokenBalance.map((token) => jobs.push(limit(() => this.processEthToken(whitelistMember.id, token))))
      fetchedTokens = await Promise.all(jobs);
      this.logger.debug(`processed ${fetchedTokens.length} tokens for ${whitelistMember.id}`);

      await this.prisma.token.createMany({
        data: fetchedTokens
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
            id: whitelistMember.id
          },
          data: {
            tokenProcessed: false,
            tokenProcessedAttemps: whitelistMember.tokenProcessedAttemps + 1
          }
        })
      } else {
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id
          },
          data: {
            tokenProcessed: true,
          }
        })
      }
      this.logger.debug(`${jobRequest.address} stored`);
    });
  }

  private async processEthToken(whitelistMemberId: string, token: TokenBalance): Promise<any> {
    let collectionInfo: CollectionInfoResponse = null;
    try {
      collectionInfo = await this.blockchainService.getCollectionInfo(token.contractAddress, 'ethereum');

      /* if(!collectionInfo?.logo){
         collectionInfo = {
           logo : token.nfts[0]?.image
         }
       }*/

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
      whitelistMemberId: whitelistMemberId,
      items: JSON.stringify(token.nfts),
      ...collectionInfo
    }
  }

  @Process({ name: SOL_QUEUE_KEY_NAME, concurrency: 1 })
  async processWhitelistMemberSol(job: Job) {
    this.logger.debug(`received job with id: ${job.id}`);
    const jobRequest = job.data.jobRequest;
    this.logger.debug(`processing whitelist member address ${jobRequest.address}`)
    const tokenBalance = await this.blockchainService.getNFTsSolana(jobRequest.address);
    const accountBalance = await this.blockchainService.getAccountBalanceSol(jobRequest.address);
    const totalNFTs = tokenBalance.reduce((accumulator, item) => accumulator + item.balance, 0);

    await this.prisma.$transaction(async () => {
      const whitelistMember = await this.prisma.whitelistMember.update({
        where: {
          id: jobRequest.whitelistMemberId
        },
        data: {
          totalTokens: totalNFTs,
          whitelistId: jobRequest.whitelistId,
        }
      });
      await this.prisma.accountBalance.create({
        data: {
          whitelistMemberId: whitelistMember.id,
          tokenBalance: accountBalance.tokenBalance,
          usdBalance: accountBalance.usdBalance,
          chainType: ChainType.SOLANA
        }
      });
      const fetchedTokens = tokenBalance.map((token) => {
        return {
          contractAddress: token.contractAddress,
          balance: token.balance,
          contractName: token.contractName,
          nftDescription: token.nftDescription,
          nftVersion: token.nftVersion,
          tokenType: mapTokenType(token.tokenType.toUpperCase()),
          whitelistMemberId: whitelistMember.id,
          items: JSON.stringify(token.nfts)
        }
      });
      const tokens = await this.prisma.token.createMany({
        data: fetchedTokens
      });

      this.logger.debug(`processed ${fetchedTokens.length} tokens for ${whitelistMember.id}`);

      if (!(fetchedTokens.length > 0)) {
        this.logger.debug(`no tokens for ${whitelistMember.address}`);
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id
          },
          data: {
            tokenProcessed: false,
            tokenProcessedAttemps: whitelistMember.tokenProcessedAttemps + 1
          }
        })
      } else {
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id
          },
          data: {
            tokenProcessed: true,
          }
        })
      }
      this.logger.debug(`${jobRequest.address} stored`);
    });
  }
}