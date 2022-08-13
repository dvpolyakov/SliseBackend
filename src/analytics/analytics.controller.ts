import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req, UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../common/interceptors/sentry.interceptor';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { AnalyticsService } from './analytics.service';
import { WhitelistInfoRequest } from './requests/whitelist-info-request';
import { WhitelistInfoResponse } from './models/whitelist-info-response';
import { AuthGuard } from '../common/interceptors/guards.interceptor';
import { JwtPayload } from '../auth/models/payload';
import { GenerateLinkRequest } from '../auth/requests/generate-link-request';
import { WhitelistPreviewResponse } from './responses/whitelist-preview-response';
import { WhitelistSettingsResponse } from './responses/whitelist-settings-response';
import { WhitelistSettingsRequest } from './requests/whitelist-settings-request';
import {
  MutualHoldingsResponse, TargetingResponse,
  TopHoldersDashboardResponse,
  WhitelistStatisticsResponse
} from './models/whitelist-statistics-response';
import { WhitelistResponse } from './responses/whitelist-response';
import { ProjectInfoRequest, ProjectInfoResponse } from './requests/project-info-request';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Slice')
@UseInterceptors(SentryInterceptor, TransformInterceptor)
@Controller({ path: 'api/analytics' })
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService) {
  }

  @Get('test')
  async testEndpoint(@Query('id') id: string) {
    return await this.analyticsService.test(id);
  }

  @UseGuards(AuthGuard)
  @Get('whitelists')
  async whitelists(@Req() requestContext: any): Promise<WhitelistResponse[]> {
    return await this.analyticsService.getWhitelists(requestContext.user as JwtPayload);
  }

  @UseGuards(AuthGuard)
  @Post('storeWhitelist')
  async storeClearWhitelist(@Body(new ValidationPipe()) request: WhitelistInfoRequest, @Req() requestContext: any): Promise<WhitelistInfoResponse> {
    return await this.analyticsService.storeClearWhitelist(request, requestContext.user as JwtPayload);
  }

  @UseGuards(AuthGuard)
  @Put('regenerateLink')
  async regenerateLink(@Body(new ValidationPipe()) request: GenerateLinkRequest, @Req() requestContext: any): Promise<string> {
    return await this.analyticsService.regenerateLink(request, requestContext.user as JwtPayload);
  }

  @Get('collection/:link')
  async collectionInfo(@Param('link') link: string): Promise<WhitelistPreviewResponse> {
    return await this.analyticsService.getWhitelistInfoByLink(link);
  }

  @UseGuards(AuthGuard)
  @Get('whitelistSettings')
  async whitelistSettings(@Query('whitelistId') whitelistId: string, @Req() requestContext: any): Promise<WhitelistSettingsResponse> {
    return await this.analyticsService.getWhitelistSettings(whitelistId, requestContext.user as JwtPayload);
  }

  @UseGuards(AuthGuard)
  @Get('whitelistInfo')
  async whitelistProjectInfo(@Query('whitelistId') whitelistId: string, @Req() requestContext: any): Promise<ProjectInfoResponse> {
    return await this.analyticsService.getWhitelistInfo(whitelistId, requestContext.user as JwtPayload);
  }

  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @Put('whitelistInfo/:whitelistId')
  async updateProjectInfo(@Param('whitelistId') whitelistId: string, @Body() whitelist: ProjectInfoRequest, @Req() requestContext: any, @UploadedFile() file?: Express.Multer.File): Promise<ProjectInfoResponse> {
    return await this.analyticsService.updateWhitelistInfo(whitelistId, whitelist, requestContext.user as JwtPayload, file);
  }

  @Get('getTargets')
  async getTargets(@Query('vector') vector: number): Promise<any> {
    const response = await this.analyticsService.getTargets(vector);
    return response;
  }

  @Get('getExport')
  async getExport(@Query('vector') vector: number): Promise<TargetingResponse> {
    const response = await this.analyticsService.exportTargets(vector);
    return response;
  }

  @UseGuards(AuthGuard)
  @Put('whitelistSettings/:whitelistId')
  async updateWhitelistSettings(@Param('whitelistId') whitelistId: string, @Body() whitelist: WhitelistSettingsRequest, @Req() requestContext: any): Promise<WhitelistSettingsResponse> {
    return await this.analyticsService.updateWhitelistSettings(whitelistId, whitelist, requestContext.user as JwtPayload);
  }

  @UseGuards(AuthGuard)
  @Get('whitelistStatistics')
  async whitelistStatistics(@Query('whitelistId') whitelistId: string, @Req() requestContext: any): Promise<WhitelistStatisticsResponse> {
    return await this.analyticsService.getWhitelistStatistics(whitelistId, requestContext.user as JwtPayload);
  }

  @UseGuards(AuthGuard)
  @Get('mutualHoldings')
  async mutualHoldings(@Query('whitelistId') whitelistId: string, @Req() requestContext: any): Promise<MutualHoldingsResponse[]> {
    return await this.analyticsService.getMutualHoldings(whitelistId, requestContext.user as JwtPayload);
  }

  @UseGuards(AuthGuard)
  @Get('topHolders')
  async topHolders(@Query('whitelistId') whitelistId: string, @Req() requestContext: any): Promise<TopHoldersDashboardResponse> {
    return await this.analyticsService.getTopHolders(whitelistId, requestContext.user as JwtPayload);
  }
}
