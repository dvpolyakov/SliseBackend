import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { mapTokenType } from '../utils/token-mapper';
import { TransferProcessedStatus } from '@prisma/client';
import { BigInt } from 'postgres';


@Injectable()
export class SchedulerService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService
  ) {
  }

  private readonly logger = new Logger(SchedulerService.name);

  // @Cron(CronExpression.EVERY_30_MINUTES)
  // async handleCron() {
  //   this.logger.debug("fetching holders");
  //   const tokens = await this.analyticsService.getTokens();
  //   await Promise.all(tokens.map(async (token) => {
  //     const response = await this.analyticsService.fetchTokenHolders(1, token.address, 5);
  //     const key = `${token.address}:holders`;
  //     await this.redis.set(key, JSON.stringify(response));
  //   }));
  //   this.logger.debug("holders saved successfully!");
  // }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processTokens() {
    this.logger.debug('fetching tokens');
    const holders = await this.prisma.tokenHolder.findMany({
      where: {
        processedTokens: false,
        processedTokensFail: false
      },
      take: 10,
    });

    await Promise.all(holders.map(async (tokenHolder) => {
      try {
        let savedTransfers: any[] = [];
        const tokenBalance = (await this.analyticsService.getTokensByAddresses([tokenHolder.address]));
        await Promise.all(tokenBalance.map(async (balance) => {
          balance.balances.map(async (token) => {
            const tokenTransfer = {
              address: token.currency.address !== undefined ? token.currency.address.toLowerCase()  : 'none',
              tokenId: BigInt.parse(token.currency.tokenId),
              amount: token.value,
              contractType: mapTokenType(token.currency.tokenType),
              metadata: null,
              transferProcessedStatus: TransferProcessedStatus.STORED,
              symbol: token.currency.symbol,
              name: token.currency.name,
              holderId: tokenHolder.id,
              waitlistId: tokenHolder.waitlistId
            };
            savedTransfers.push(tokenTransfer);
          });
        }));

        await this.prisma.$transaction(async () => {
          await this.prisma.tokenTransfer.createMany({
            data: savedTransfers
          });
          await this.prisma.tokenHolder.update({
            where: {
              id: tokenHolder.id
            },
            data: {
              processedTokens: true,
              processedTokensFail: false
            }
          });
          this.logger.debug(`holder ${tokenHolder.address} saved with transfers: ${savedTransfers.length}`);
        },
          {
            maxWait: 5000, // default: 2000
            timeout: 10000, // default: 5000
          });
      } catch (e) {
        await this.prisma.tokenHolder.update({
          where: {
            id: tokenHolder.id
          },
          data: {
            processedTokens: false,
            processedTokensFail: true
          }
        });
        this.logger.debug(`holder ${tokenHolder.address} saved with transfers error ${e.toString()}`);
      }
    }));
    this.logger.debug('fetching tokens completed');
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async fetchBalances() {
    this.logger.debug('fetching balances');
    const holders = await this.prisma.tokenHolder.findMany({
      where: {
        processedBalance: false,
        processedBalanceFail: false
      },
      take: 5
    });
    await Promise.all(holders.map(async (holder) => {
      try{
        const balance = (await this.analyticsService.fetchNewBalances(holder.address));
       /* const holderUsdBalance = balance.items.reduce(function(prev, cur) {
          return prev + cur.quote;
        }, 0);*/
        const holderUsdBalance = balance.usdBalance;
        const holderEthBalance = balance.ethBalance
        await this.prisma.$transaction(async () => {
          await this.prisma.tokenHolder.update({
            where: {
              id: holder.id
            },
            data: {
              totalBalanceUsd: +(holderUsdBalance).toFixed(5),
              totalBalanceTokens: +(holderEthBalance).toFixed(5),
              processedBalance: true,
              processedBalanceFail: false
            }
          },
            );
          this.logger.debug(`holder ${holder.address} fetched balance`);
        },
          {
            maxWait: 5000, // default: 2000
            timeout: 10000, // default: 5000
          });
      }
      catch (e){
        await this.prisma.tokenHolder.update({
          where: {
            id: holder.id
          },
          data: {
            processedBalance: false,
            processedBalanceFail: true
          }
        });
        this.logger.debug(`holder ${holder.address} balance processed error ${e.toString()}`);
      }
    }));
    this.logger.debug('fetching balances completed');
  }
}