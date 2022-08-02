import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '../auth/models/payload';

type ContextWithType = ExecutionContext & {
  contextType: string;
  user: JwtPayload;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly secretKey = process.env.SECRETKEY;

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp().getRequest()
    if (!ctx.headers.authorization) {
      return false;
    }
    ctx.user = await this.validateToken(ctx.headers.authorization);
    return true;
  }

  async validateToken(auth: string) {
    if (auth.split(' ')[0] !== 'Bearer') {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    const token = auth.split(' ')[1];

    try {
      const decoded = await jwt.verify(token, this.secretKey);
      return decoded;
    } catch (err) {
      const message = `Token error: ${err.message || err.name}`;
      throw new HttpException(message, HttpStatus.UNAUTHORIZED);
    }
  }
}
