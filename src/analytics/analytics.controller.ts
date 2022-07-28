import { Body, Controller, Get, Post, Query, UploadedFile, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Token } from '@prisma/client';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { TransformInterceptor } from '../interceptors/transform.interceptor';
import { AnalyticsService } from './analytics.service';
import { WhitelistInfoRequest } from './requests/whitelist-info-request';
import { WhitelistInfoResponse } from './models/whitelist-info-response';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MutualHoldingsResponse,
  TargetingResponse,
  TopHoldersDashboardResponse,
  WhitelistStatisticsResponse
} from './models/whitelist-statistics-response';
import { AuthWhitelistMember } from './requests/whitelist-request';

@ApiTags('Slice')
@UseInterceptors(SentryInterceptor)
@Controller({ path: 'api/analytics' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {
  }
  @Get('test')
  async testEndpoint(){
    return await this.analyticsService.test();
  }

  @Post('storeWhitelist')
  @UseInterceptors(
    TransformInterceptor,
    FileInterceptor('file'))
  async storeWhitelist(@Body(new ValidationPipe()) request: WhitelistInfoRequest, @UploadedFile() file: Express.Multer.File): Promise<WhitelistInfoResponse> {
    const response = await this.analyticsService.storeWhitelist(request, file);
    return response;
  }

  @Post('storeClearWhitelist')
  @UseInterceptors(
    TransformInterceptor,
    FileInterceptor('file'))
  async storeClearWhitelist(@Body(new ValidationPipe()) request: WhitelistInfoRequest): Promise<WhitelistInfoResponse> {
    const response = await this.analyticsService.storeClearWhitelist(request);
    return response;
  }

  @Post('authWhitelistMember')
  @UseInterceptors(TransformInterceptor)
  async getWhitelists(@Body(new ValidationPipe()) request: AuthWhitelistMember): Promise<string> {
    return await this.analyticsService.authWhitelistMember(request);
  }

  // @Get('getWhitelists')
  // @UseInterceptors(TransformInterceptor)
  // async getWhitelists(): Promise<Waitlist[]> {
  //   const response = await this.analyticsService.getWhitelists();
  //   return response;
  // }

  // @Get('getWhitelistStatistics')
  // @UseInterceptors(TransformInterceptor)
  // async getWhitelistStatistics(@Query('id') id: string): Promise<WhitelistStatisticsResponse> {
  //   const response = await this.analyticsService.getWhitelistStatistics(id);
  //   return response;
  // }

  // @Get('getTopHolders')
  // @UseInterceptors(TransformInterceptor)
  // async getTopHolders(@Query('id') id: string): Promise<TopHoldersDashboardResponse> {
  //   const response = await this.analyticsService.getTopHolders(id);
  //   return response;
  // }

  // @Get('getExport')
  // @UseInterceptors(TransformInterceptor)
  // async getExport(@Query('vector') vector: number): Promise<TargetingResponse> {
  //   const response = await this.analyticsService.exportTargets(vector);
  //   return response;
  // }

  // @Get('getTargets')
  // @UseInterceptors(TransformInterceptor)
  // async getTargets(@Query('vector') vector: number): Promise<number> {
  //   const response = await this.analyticsService.getTargets(vector);
  //   return response;
  // }

  // @Get('getMutualHoldings')
  // @UseInterceptors(TransformInterceptor)
  // async getMutualHoldings(@Query('id') id: string): Promise<MutualHoldingsResponse[]> {
  //   const response = await this.analyticsService.getMutualHoldings(id);
  //   return response;
  // }
}
