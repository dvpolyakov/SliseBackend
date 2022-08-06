import { Logger, Scope } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import papaparse from 'papaparse';
import { mapTokenType } from '../common/utils/token-mapper';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ChainType } from '@prisma/client';
import { ETH_QUEUE_KEY_NAME, SOL_QUEUE_KEY_NAME } from '../common/utils/redis-consts';
import { TokenBalance } from '../analytics/models/token-info';
import pLimit from 'p-limit';

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
      const limit = pLimit(2);
      let fetchedTokens: any[] = [];
      let jobs: any[] = [];
      tokenBalance.map((token) => jobs.push(limit(() => this.processToken(whitelistMember.id, token))))

      fetchedTokens = await Promise.all(jobs);
     /* const fetchedTokens = tokenBalance.map((token) => {
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
      });*/
      const tokens = await this.prisma.token.createMany({
        data: fetchedTokens
      });

      if (!(fetchedTokens.length > 0)) {
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id
          },
          data: {
            tokenProcessed: false,
            tokenProcessedAttemps: whitelistMember.tokenProcessedAttemps + 1
          }
        })
      }
      this.logger.debug(`${jobRequest.address} stored`);
    });
  }

  private async processToken(whitelistMemberId: string, token: TokenBalance): Promise<any> {
    let collectionInfo
    try{
      collectionInfo = await this.blockchainService.getCollectionInfo(token.contractAddress, 'ethereum');
    }
    catch (e) {
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
      collectionInfo: collectionInfo
    }
  }

  @Process({ name: SOL_QUEUE_KEY_NAME, concurrency: 1 })
  async processWhitelistMemberSol(job: Job) {
    this.logger.debug(`received job with id: ${job.id}`);
    const jobRequest = job.data.jobRequest;
    this.logger.debug(`processing whitelist member address ${jobRequest.address}`)
    const tokenBalance = await this.blockchainService.getNFTsSolana(jobRequest.address);
    const accountBalance = await this.blockchainService.getAccountBalanceEth(jobRequest.address);
    const totalNFTs = tokenBalance.reduce((accumulator, item) => accumulator + item.balance, 0);

    await this.prisma.$transaction(async () => {
      const whitelistMember = await this.prisma.whitelistMember.create({
        data: {
          address: jobRequest.address,
          totalTokens: totalNFTs,
          whitelistId: jobRequest.whitelistId,
          tokenProcessedAttemps: 0
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

      if (!(fetchedTokens.length > 0)) {
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id
          },
          data: {
            tokenProcessed: false,
            tokenProcessedAttemps: whitelistMember.tokenProcessedAttemps + 1
          }
        })
      }
      this.logger.debug(`${jobRequest.address} stored`);
    });
  }
}