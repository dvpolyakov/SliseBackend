import { Logger, Scope } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import papaparse from 'papaparse';
import { mapTokenType } from '../utils/token-mapper';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ChainType } from '@prisma/client';

@Processor({ name: 'waitlist', scope: Scope.DEFAULT })
export class TokenProcessorService {

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService
  ) {
  }

  private readonly logger = new Logger(TokenProcessorService.name);

  @Process({name: 'processWhitelistMemberEth', concurrency: 1})
  async processWhitelistMemberEth(job: Job) {
    this.logger.debug(`received job with id: ${job.id}`);
    const request = job.data.request;
    this.logger.debug(`processing whitelist member address ${request.address}`)
    const tokenBalance = await this.blockchainService.getNFTsEthereum(request.address);
    const accountBalance = await this.blockchainService.getAccountBalanceEth(request.address);
    const totalNFTs = tokenBalance.reduce((accumulator, item) => accumulator + item.balance, 0);

    await this.prisma.$transaction(async () => {
      const whitelistMember = await this.prisma.whitelistMember.create({
        data: {
          address: request.address,
          totalTokens: totalNFTs,
          whitelistId: request.whitelistId,
          tokenProcessedAttemps: 0,
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
      this.logger.debug(`${request.address} stored`);
    });
  }

  @Process({name: 'processWhitelistMemberSol', concurrency: 1})
  async processWhitelistMemberSol(job: Job) {
    this.logger.debug(`received job with id: ${job.id}`);
    const request = job.data.request;
    this.logger.debug(`processing whitelist member address ${request.address}`)
    const tokenBalance = await this.blockchainService.getNFTsSolana(request.address);
    const accountBalance = await this.blockchainService.getAccountBalanceEth(request.address);
    const totalNFTs = tokenBalance.reduce((accumulator, item) => accumulator + item.balance, 0);

    await this.prisma.$transaction(async () => {
      const whitelistMember = await this.prisma.whitelistMember.create({
        data: {
          address: request.address,
          totalTokens: totalNFTs,
          whitelistId: request.whitelistId,
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
      this.logger.debug(`${request.address} stored`);
    });
  }
}