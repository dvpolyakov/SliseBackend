import { Injectable, Logger } from '@nestjs/common';
import { NetworkNames, randomPrivateKey, Sdk } from 'etherspot';
import { AccountBalanceResponse } from './models/account-balance';
import { TokenBalance } from '../analytics/models/token-info';
import { HttpService } from '@nestjs/axios';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
//import { LogDecoder } from "@maticnetwork/eth-decoder"
import { ERC1155TokenABI, ERC20TokenABI, ERC721TokenABI } from '../common/utils/abi';

const SOL_RPC = 'https://api.mainnet-beta.solana.com';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly sdkPrivatKey = randomPrivateKey();
  private readonly etherspotSDK;
  private readonly web3 = require('web3');
  private LogsDecoder = require('logs-decoder');
  private ethers = require('ethers');
  private readonly provider;
  private readonly logsDecoder;

  constructor(private readonly httpService: HttpService, @InjectRedis() private readonly redis: Redis) {
    this.etherspotSDK = new Sdk(this.sdkPrivatKey, {
      networkName: 'mainnet' as NetworkNames,
    });
    this.web3 = new this.web3(
      new this.web3.providers.HttpProvider('https://api.mycryptoapi.com/eth'),
    );

    this.provider = new this.ethers.providers.JsonRpcProvider(
      {
        url: 'https://holy-summer-wildflower.discover.quiknode.pro/e42546214ee1fb81233b1beeaa416b1e6979570e/',
        headers: {
          "x-qn-api-version": 1
        }
      });

    this.logsDecoder = this.LogsDecoder.create();
    this.logsDecoder.addABI(ERC20TokenABI);
    this.logsDecoder.addABI(ERC721TokenABI);
    this.logsDecoder.addABI(ERC1155TokenABI);

    // this.logsDecoder = new LogDecoder(
    //   [
    //     ERC20TokenABI,
    //     ERC721TokenABI,
    //     ERC1155TokenABI
    //   ]
    // );
  }

  public async test(): Promise<any> {
    const data = await this.getNFTsSolana('EatSzWzfeo47TKCVQn6khv3qgWA9oKg28sfHcA4wsBZ1');
    return data;
  }

  private getNewSdk(network: string): Sdk {
    return new Sdk(this.sdkPrivatKey, {
      networkName: network as NetworkNames,
    });
  }

  private async fetchNFTsSolana(address: string, page: number): Promise<any> {
    const response = await this.httpService.post('https://dry-small-silence.solana-mainnet.discover.quiknode.pro/d5701a29449dd7789630ec39f38ec793bfba2822/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'qn_fetchNFTs',
      params: {
        wallet: address,
        omitFields: ['provenance', 'traits'],
        page: page,
        perPage: 20,
      },
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    }).toPromise();
    let data = response.data.result.assets;
    if (response.data.result.totalPages > page) {
      return data.concat(await Promise.all(await this.fetchNFTsSolana(address, page + 1)));
    } else {
      return data || [];
    }
  }

  public async getNFTsSolana(address: string): Promise<any> {
    const data = await Promise.all(await this.fetchNFTsSolana(address, 1));
    const uniqueTokens = [...new Map(data.map(item =>
      [item['collectionAddress'], item])).values()];

    const nfts = uniqueTokens.map((item) => {
      const tokens = data.filter(x => x.collectionAddress === item.collectionAddress);
      let collectionName;
      if (item.collectionName === 'Unknown') {
        const idx = item.name.lastIndexOf('#')
        if (idx !== -1) {
          collectionName = item.name.substring(0, idx);
        } else {
          collectionName = item.name;
        }
      } else {
        collectionName = item.collectionName
      }
      return {
        contractName: collectionName,
        contractSymbol: 'SOL',
        contractAddress: item.collectionAddress,
        tokenType: 'SOL',
        nftVersion: null,
        nftDescription: item.description,
        balance: tokens.length,
        nfts: tokens.map((nft) => {
          return {
            tokenId: 0,
            name: nft.name,
            amount: 0,
            image: nft.imageUrl
          }
        })
      }
    });

    return nfts;
  }

  public async getNFTsEthereum(address: string): Promise<TokenBalance[]> {
    try {
      const sdk = this.getNewSdk('mainnet');
      const data = await sdk.getNftList({
        account: address,
      });
      return data.items.map((item) => {
        return {
          contractName: item.contractName,
          contractSymbol: item.contractSymbol,
          contractAddress: item.contractAddress,
          tokenType: item.tokenType,
          nftVersion: item.nftVersion,
          nftDescription: item.nftDescription,
          balance: +item.balance,
          nfts: item.items.map((nft) => {
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

  public async getAccountBalanceEth(address: string): Promise<AccountBalanceResponse> {
    try {
      const ethBalance = await this.getEthBalance(address);
      const usd = +(await this.redis.get('ethUsdPrice'));
      const usdBalance = +(usd * ethBalance);

      const data = {
        tokenBalance: ethBalance,
        usdBalance: usdBalance
      };
      return data;
    } catch {
      return {
        tokenBalance: 0,
        usdBalance: 0
      }
    }
  }

  public async getAccountBalanceSol(address: string): Promise<AccountBalanceResponse> {
    try {
      const solBalance = await this.getSolBalance(address);
      const usd = +(await this.redis.get('ethSolPrice'));
      const usdBalance = +(usd * solBalance);

      const data = {
        tokenBalance: solBalance,
        usdBalance: usdBalance
      };
      return data;
    } catch {
      return {
        tokenBalance: 0,
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

  private async getSolBalance(address: string): Promise<number> {
    const response = await this.httpService.post(SOL_RPC,
      {
        jsonrpc: '2.0',
        'method': 'getBalance',
        'params': [
          address
        ],
        'id': 0
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }).toPromise();

    const data = response.data.result?.value | 0;
    const value = data / 1_000_000_000;

    return value;
  }
}