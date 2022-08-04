import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
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
import { WhiteListPreviewResponse } from './responses/whitelist-preview-response';
import { WhitelistSettingsResponse } from './responses/whitelist-settings-response';
import { WhitelistSettingsRequest } from './requests/whitelist-settings-request';

@ApiTags('Slice')
@UseInterceptors(SentryInterceptor)
@Controller({ path: 'api/analytics' })
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService) {
  }

  @UseGuards(AuthGuard)
  @Get('test')
  async testEndpoint() {
    return await this.analyticsService.test();
  }

  @UseGuards(AuthGuard)
  @Post('storeWhitelist')
  @UseInterceptors(TransformInterceptor)
  async storeClearWhitelist(@Body(new ValidationPipe()) request: WhitelistInfoRequest, @Req() requestContext: any): Promise<WhitelistInfoResponse> {
    const response = await this.analyticsService.storeClearWhitelist(request, requestContext.user as JwtPayload);
    return response;
  }

  @UseGuards(AuthGuard)
  @Put('regenerateLink')
  @UseInterceptors(TransformInterceptor)
  async regenerateLink(@Body(new ValidationPipe()) request: GenerateLinkRequest, @Req() requestContext: any): Promise<string> {
    return await this.analyticsService.regenerateLink(request, requestContext.user as JwtPayload);
  }

  @Get('collection/:link')
  @UseInterceptors(TransformInterceptor)
  async whitelistInfo(@Param('link') link: string): Promise<WhiteListPreviewResponse> {
   return await this.analyticsService.getWhitelistInfoByLink(link);
  }

  @UseGuards(AuthGuard)
  @Get('whitelistSettings')
  @UseInterceptors(TransformInterceptor)
  async whitelistSettings(@Query('whitelistId') whitelistId: string,  @Req() requestContext: any): Promise<WhitelistSettingsResponse> {
    return await this.analyticsService.getWhitelistSettings(whitelistId, requestContext.user as JwtPayload);
  }

  @UseGuards(AuthGuard)
  @Put('whitelistSettings/:whitelistId')
  @UseInterceptors(TransformInterceptor)
  async updateWhitelistSettings(@Param('whitelistId') whitelistId: string, @Body() whitelist: WhitelistSettingsRequest,  @Req() requestContext: any): Promise<WhitelistSettingsResponse> {
    return await this.analyticsService.updateWhitelistSettings(whitelistId, whitelist, requestContext.user as JwtPayload);
  }
}
