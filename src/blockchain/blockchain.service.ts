import { Injectable, Logger } from '@nestjs/common';
import { NetworkNames, randomPrivateKey, Sdk } from 'etherspot';
import { AccountBalanceResponse } from './models/account-balance';
import { TokenBalance } from '../analytics/models/token-info';
import { HttpService } from '@nestjs/axios';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly sdkPrivatKey = randomPrivateKey();
  private readonly etherspotSDK;
  private readonly ethPrice = require('eth-price');
  private readonly web3 = require('web3');

  constructor(private readonly httpService: HttpService, @InjectRedis() private readonly redis: Redis) {
    this.etherspotSDK = new Sdk(this.sdkPrivatKey, {
      networkName: 'mainnet' as NetworkNames,
    });
    this.web3 = new this.web3(
      new this.web3.providers.HttpProvider(
        `https://api.mycryptoapi.com/eth`
      )
    );
  }

  private getNewSdk(network: string): Sdk {
    return new Sdk(this.sdkPrivatKey, {
      networkName: network as NetworkNames,
    });
  }

  public async getNFTs(address: string): Promise<TokenBalance[]> {
    try {
      const sdk = this.getNewSdk('mainnet');
      const data = await sdk.getNftList({
        account: address,
      });
      return data.items.map(item => {
        return {
          contractName: item.contractName,
          contractSymbol: item.contractSymbol,
          contractAddress: item.contractAddress,
          tokenType: item.tokenType,
          nftVersion: item.nftVersion,
          nftDescription: item.nftDescription,
          balance: +item.balance,
          nfts: item.items.map(nft => {
            return {
              tokenId: +nft.tokenId,
              name: nft.name,
              amount: nft.amount,
              image: nft.image
            }
          })
        }
      });
    } catch {
      this.logger.debug(`error processing address ${address}`);
    }
  }

  public async getAccountBalance(address: string): Promise<AccountBalanceResponse> {
    try {
      const ethBalance = await this.getEthBalance(address);
      const usd = +(await this.redis.get('ethUsdPrice'));
      const usdB = +(usd * ethBalance);

      const data = {
        ethBalance: ethBalance,
        usdBalance: usdB
      };
      return data;
    } catch {
      return {
        ethBalance: 0,
        usdBalance: 0
      }
    }
  }

  private async getEthBalance(address: string): Promise<number> {
    const sdk = this.getNewSdk('mainnet');
    const balance = await sdk.getAccountBalances({
      account: address
    });
    const hexBalance = balance.items[0].balance._hex ?? '0';
    const parsed = parseInt(hexBalance, 16);
    const toEther = +(this.web3.utils.fromWei(parsed.toString(), 'ether'));
    return toEther;
  }
}