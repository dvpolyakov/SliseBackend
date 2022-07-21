import { Body, Controller, Get, Post, Query, UploadedFile, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Token, Waitlist } from '@prisma/client';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { TransformInterceptor } from '../interceptors/transform.interceptor';
import { AnalyticsService } from './analytics.service';
import { WhitelistInfoRequest } from './requests/whitelist-info-request';
import { WhitelistInfoResponse } from './models/whitelist-info-response';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MutualHoldingsResponse,
  TopHoldersResponse,
  WhitelistStatisticsResponse
} from './models/whitelist-statistics-response';

@ApiTags('Slice')
@UseInterceptors(SentryInterceptor)
@Controller({ path: 'api/analytics' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {
  }

  @Get('getTokens')
  @UseInterceptors(TransformInterceptor)
  async getTokens(): Promise<Token[]> {
    const result = await this.analyticsService.getTokens();
    return result;
  }

  /*
    @Get('tokenEventsByContracts/:token')
    @UseInterceptors(TransformInterceptor)
    async getHoldersByContracts(
      @Param('token') token: string,
      @Query('network') network: number,
      @Query('pageSize') pageSize: number): Promise<BlockChainUserEvent[]> {
      return await this.analyticsService.tokenEventsByContract(network, token, pageSize);
    }*/

  /*
   @Get('token/:token')
   @UseInterceptors(TransformInterceptor)
   async getHolders(
       @Param('token') token: string,
       @Query('network') network: number,
       @Query('pageSize') pageSize: number): Promise<TokenHolder[]> {
       return await this.analyticsService.tokenHolders(network, token, pageSize);
   }

   @Get('tokenHolders/:token')
   @UseInterceptors(TransformInterceptor)
   async getTimelineHolders(
       @Param('token') token: string,
       @Query('network') network: number,
       @Query('pageSize') pageSize: number,
       @Query('startDate') startDate: string,
       @Query('endDate') endDate: string,
       @Query('period') period: string): Promise<TimestampEvent[]> {
       return await this.analyticsService.tokenHoldersBetweenDates(network, token, pageSize, startDate, endDate, period);
   }

   @Get('tokenFromSource/:token')
   @UseInterceptors(TransformInterceptor)
   async getHoldersFromSource(
       @Param('token') token: string,
       @Query('network') network: number,
       @Query('pageSize') pageSize: number): Promise<TokenHolder[]> {
       return await this.analyticsService.tokenHoldersFromSource(network, token, pageSize);
   }

   @Get('eventsByAddress/:contractAddress')
   @UseInterceptors(TransformInterceptor)
   async getEventsByAddress(
       @Param('contractAddress') contractAddress: string,
       @Query('startDate') startDate: string,
       @Query('endDate') endDate: string,
       @Query('pageSize') pageSize: number,
       @Query('page') page: number): Promise<any> {
       return await this.analyticsService.eventsByAddress(contractAddress, startDate, endDate, pageSize, page);
   }

   @Get('eventsByContractsAndAddreses')
   @UseInterceptors(TransformInterceptor)
   async getEventsByContractsAndAddress(
       @Query(new ValidationPipe({ transform: true })) request: BlockChainEventRequest): Promise<BlockChainUserEvent[]> {
       const response = await this.analyticsService.eventsByContractsAndAddresses(request.contractsAddresses, request.addresses);

       return response;
   }*/

  @Get('parseHolders')
  @UseInterceptors(TransformInterceptor)
  async parseHolders(
    @Query(new ValidationPipe(/*{ transform: true }*/)) request: WhitelistInfoRequest): Promise<string> {
    const id = await this.analyticsService.parseHolders(request);
    return id;
  }

  @Post('storeWhitelist')
  @UseInterceptors(
    TransformInterceptor,
    FileInterceptor('file'))
  async storeWhitelist(@Body(new ValidationPipe()) request: WhitelistInfoRequest, @UploadedFile() file: Express.Multer.File): Promise<WhitelistInfoResponse> {
    const response = await this.analyticsService.storeWaitlist(request, file);
    return response;
  }

  @Get('getWhitelists')
  @UseInterceptors(TransformInterceptor)
  async getWhitelists(): Promise<Waitlist[]> {
    const response = await this.analyticsService.getWhitelists();
    return response;
  }

  @Get('getWhitelistStatistics')
  @UseInterceptors(TransformInterceptor)
  async getWhitelistStatistics(@Query('id') id: string): Promise<WhitelistStatisticsResponse> {
    const response = await this.analyticsService.getWhitelistStatistics(id);
    return response;
  }

  @Get('getTopHolders')
  @UseInterceptors(TransformInterceptor)
  async getTopHolders(@Query('id') id: string): Promise<TopHoldersResponse[]> {
    const response = await this.analyticsService.getTopHolders(id);
    return response;
  }

  @Get('getMutualHoldings')
  @UseInterceptors(TransformInterceptor)
  async getMutualHoldings(@Query('id') id: string): Promise<MutualHoldingsResponse[]> {
    const response = await this.analyticsService.getMutualHoldings(id);
    return response;
  }
}
