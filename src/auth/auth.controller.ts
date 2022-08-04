import { Body, Controller, Post, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../common/interceptors/sentry.interceptor';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { AuthUserRequest } from './requests/auth-user-request';
import { AuthService } from './auth.service';
import { AuthWhitelistMember } from './requests/auth-whitelistmember-request';
import { JwtTokenModel } from './models/jwt-model';

@ApiTags('Slice')
@UseInterceptors(SentryInterceptor)
@Controller({ path: 'api/auth' })
export class AuthController {
  constructor(
    private readonly authService: AuthService) {
  }

  @Post('authUser')
  @UseInterceptors(TransformInterceptor)
  async authUser(@Body(new ValidationPipe()) request: AuthUserRequest): Promise<JwtTokenModel> {
    return await this.authService.authUser(request);
  }

  @Post('authWhitelistMember')
  @UseInterceptors(TransformInterceptor)
  async getWhitelists(@Body(new ValidationPipe()) request: AuthWhitelistMember): Promise<string> {
    return await this.authService.authWhitelistMember(request);
  }
}