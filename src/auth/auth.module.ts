import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [
    UserModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
      property: 'user',
      session: false,
    }),
    JwtModule.register({
      secret: process.env.SECRETKEY,
      signOptions: {
        expiresIn: `${process.env.EXPIRESIN}d`,
      },
    }),
    BullModule.registerQueue({
      name: 'whitelist',
    }),
    AnalyticsModule,
    PrismaModule,
    IntegrationModule
  ],
  providers: [AuthService, JwtStrategy, AuthController],
  exports: [AuthService, PassportModule, JwtModule, AuthController]
})
export class AuthModule {}
