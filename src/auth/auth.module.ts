import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { AuthController } from './auth.controller';

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
  ],
  providers: [AuthService, JwtStrategy, AuthController],
  exports: [AuthService, PassportModule, JwtModule, AuthController]
})
export class AuthModule {}
