import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly secretKey = process.env.SECRETKEY;

  private readonly Web3 = require('web3');

  constructor(private readonly reflector: Reflector) {
    this.Web3 = new this.Web3(
      new this.Web3.providers.HttpProvider('https://api.mycryptoapi.com/eth'),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp().getRequest();
    if (!ctx.headers.authorization) {
      return false;
    }
    ctx.user = await this.validateAddress(ctx.headers.authorization);
    return true;
  }

  async validateAddress(auth: string) {
    // TODO Chain after sep address
    // if (auth.split(' ')[0] !== 'Metamask' || auth.split(' ')[0] !== 'Phantom') {
    if (auth.split(' ')[0] !== 'Bearer') {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    /*   const address = auth.split(' ')[1];

    //TODO Also check solana
    const isAddress = this.web3.utils.isAddress(address);
    if(!isAddress){
      const message = `Invalid address`;
      throw new HttpException(message, HttpStatus.UNAUTHORIZED);
    }
*/
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
