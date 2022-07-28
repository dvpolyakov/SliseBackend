import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

@Injectable()
export class WarmupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WarmupService.name);
  private readonly ethPrice = require('eth-price');
  constructor(@InjectRedis() private readonly redis: Redis) {

  }
  onApplicationBootstrap() {
    this.fetchEthPrice();
  }

  async fetchEthPrice() {
    const usdBalance = (await this.ethPrice('usd'))[0];
    const usd = +(usdBalance.substr(5, usdBalance.length));
    this.logger.debug(`current eth-usd price ${usd}`);
    await this.redis.set('ethUsdPrice', usd);
  }
}