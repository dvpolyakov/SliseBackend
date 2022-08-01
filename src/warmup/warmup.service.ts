import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

const BINANCE_API_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=';

@Injectable()
export class WarmupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WarmupService.name);
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly httpService: HttpService
    ) {

  }
  onApplicationBootstrap() {
    this.fetchEthPrice();
    this.fetchSolPrice();
  }

  async fetchEthPrice() {
    const response = await this.httpService.get(`${BINANCE_API_URL}ETHUSDT`).toPromise();
    const ethUsdt = +response.data.price;
    this.logger.debug(`current eth-usdt price ${ethUsdt.toFixed(2)}`);
    await this.redis.set('ethUsdPrice', ethUsdt.toFixed(2));
  }

  async fetchSolPrice() {
    const response = await this.httpService.get(`${BINANCE_API_URL}SOLUSDT`).toPromise();
    const solUsdt = +response.data.price;
    this.logger.debug(`current sol-usdt price ${solUsdt.toFixed(2)}`);
    await this.redis.set('solUsdPrice', solUsdt.toFixed(2));
  }
}