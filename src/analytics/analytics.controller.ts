import { Body, Controller, Get, Post, UploadedFile, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { TransformInterceptor } from '../interceptors/transform.interceptor';
import { AnalyticsService } from './analytics.service';
import { WhitelistInfoRequest } from './requests/whitelist-info-request';
import { WhitelistInfoResponse } from './models/whitelist-info-response';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthWhitelistMember } from './requests/auth-whitelistmember-request';

@ApiTags('Slice')
@UseInterceptors(SentryInterceptor)
@Controller({ path: 'api/analytics' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {
  }

  @Get('test')
  async testEndpoint() {
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
}
