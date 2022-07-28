import { Logger, Scope } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import papaparse from 'papaparse';

@Processor({ name: 'waitlist', scope: Scope.DEFAULT })
export class TokenProcessorService {

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService
  ) {
  }

  private readonly logger = new Logger(TokenProcessorService.name);
  //TODO: Move to one loop: fetching -> parsing -> storing
  //TODO: fix try/catch
  @Process({ name: 'parseAndStore', concurrency: 1 })
  async parseAndStore(job: Job) {
  //   this.logger.debug(`received job with id: ${job.id}`);

  //   this.logger.debug(`parsing job with id: ${job.id}`);
  //   const holders = job.data.holdersRequest;

  //   try {
  //     const file = holders.file;
  //     const data = Buffer.from(file.Body).toString('utf8');
  //     const parsedCsv = await papaparse.parse(data, {
  //       header: false,
  //       skipEmptyLines: true,
  //       complete: (results) => results.data
  //     });
  //     //TODO: change to map in map
  //     let addresses: string[] = [];
  //     parsedCsv.data.map((subarray) => subarray.map((address) => {
  //       addresses.push(address);
  //     }));
  //     await this.prisma.waitlist.update({
  //       where: {
  //         id: holders.id
  //       },
  //       data: {
  //         size: addresses.length
  //       }
  //     })
  //     let savedHolders: any[] = [];
  //     addresses.map((tokenHolder) => {
  //       const dataHolder = {
  //         address: tokenHolder.toLowerCase(),
  //         totalBalanceTokens: 0,
  //         totalBalanceUsd: 0,
  //         ethBalance: 0,
  //         firstTransactionDate: new Date(),
  //         volume: 0,
  //         waitlistId: holders.waitlistId
  //       };
  //       savedHolders.push(dataHolder);
  //       this.logger.debug(`holder ${tokenHolder} parsed`);
  //     });
  //     await this.prisma.tokenHolder.createMany({
  //       data: savedHolders
  //     });

  //     //await this.analyticsService.startTargeting(holders.id);

  //     this.logger.debug(`saved ${savedHolders.length} holders`);
  //   } catch (e) {
  //     const error = e.toString();
  //     this.logger.debug(
  //       `Error processing job with id: ${job.id} error: ${JSON.stringify({ error })}`
  //     );
  //   } finally {

  //   }
  //   this.logger.debug(`job with id: ${job.id} done successful`);
  }
}