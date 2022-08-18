import { Injectable, Logger } from '@nestjs/common';
import { NetworkNames, randomPrivateKey, Sdk } from 'etherspot';
import { HttpService } from '@nestjs/axios';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { CollectionInfoResponse } from '../analytics/models/whitelist-statistics-response';
import { TokenBalance } from '../analytics/models/token-info';
import { AccountBalanceResponse } from './models/account-balance';
import { PrismaService } from '../prisma/prisma.service';

const SOL_RPC = 'https://api.mainnet-beta.solana.com';
const ETH_RPC = 'https://rpc.ankr.com/eth';
const SOL_QUICKNODE =
  'https://dry-small-silence.solana-mainnet.discover.quiknode.pro/d5701a29449dd7789630ec39f38ec793bfba2822/';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);

  private readonly sdkPrivatKey = randomPrivateKey();

  private readonly etherspotSDK;

  private readonly Web3 = require('web3');

  private ethers = require('ethers');

  private readonly provider;

  private readonly PosClient;

  constructor(
    private readonly httpService: HttpService,
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {
    this.etherspotSDK = new Sdk(this.sdkPrivatKey, {
      networkName: 'mainnet' as NetworkNames,
    });
    this.Web3 = new this.Web3(new this.Web3.providers.HttpProvider(ETH_RPC));

    this.provider = new this.ethers.providers.JsonRpcProvider({
      url: 'https://holy-summer-wildflower.discover.quiknode.pro/e42546214ee1fb81233b1beeaa416b1e6979570e/',
      headers: {
        'x-qn-api-version': 1,
      },
    });
  }

  public async test(id: string): Promise<any> {
    const a = await this.getAccountBalancePolygon(
      '0xb3db45478c3550e066260677f3d8c4ec886bdcc8',
    );
    return a;
  }

  // private async opensea(): Promise<any> {
  //   const options = {
  //     debug: false,
  //     sort: true,
  //     logs: true,
  //     additionalWait: 0,
  //     browserInstance: undefined,
  //   };
  //
  //   const basicInfo = await OpenseaScraper.basicInfo('boredapeyachtclub');
  //   return basicInfo;
  // }

  public async getCollectionInfo(
    address: string,
    network: string,
  ): Promise<CollectionInfoResponse> {
    network = network.toLowerCase();
    try {
      const query = `https://api.nftport.xyz/v0/nfts/${address}?chain=${network}&page_number=1&page_size=1&include=all&refresh_metadata=true`;
      const response = await this.httpService
        .get(query, {
          headers: {
            Authorization: `${process.env.NFTPORT_API_KEY}`,
          },
        })
        .toPromise();

      const { data } = response;
      const collectionStats = await this.getCollectionStats(address, network);
      const result: CollectionInfoResponse = {
        totalSupply: data.total || 0,
        logo: data.contract.metadata.thumbnail_url,
        ...collectionStats,
      };

      return result;
    } catch (e) {
      this.logger.debug(`error processing token ${address} ${e.toString()}`);
      return null;
    }
  }

  private async getCollectionStats(
    address: string,
    network: string,
  ): Promise<CollectionInfoResponse> {
    const query = `https://api.nftport.xyz/v0/transactions/stats/${address}?chain=${network}`;

    const response = await this.httpService
      .get(query, {
        headers: {
          Authorization: `${process.env.NFTPORT_API_KEY}`,
        },
      })
      .toPromise();

    const { data } = response;
    return {
      floorPrice: data.statistics.floor_price || null,
      total_supply: data.statistics.total_supply || 10000,
      mintPrice: data.statistics.floor_price / 2,
      numOwners: data.statistics.num_owners || null,
      averagePrice: data.statistics.average_price || null,
      floorPriceHistoricOneDay:
        data.statistics.floor_price_historic_one_day || null,
      floorPriceHistoricSevenDay:
        data.statistics.floor_price_historic_seven_day || null,
      floorPriceHistoricThirtyDay:
        data.statistics.floor_price_historic_thirty_day || null,
      marketCap: data.statistics.market_cap || null,
      oneDayAveragePrice: data.statistics.one_day_average_price || null,
      oneDayChange: data.statistics.one_day_change || null,
      oneDaySales: data.statistics.one_day_sales || null,
      oneDayVolume: data.statistics.one_day_volume || null,
      sevenDayAveragePrice: data.statistics.seven_day_average_price || null,
      sevenDayChange: data.statistics.seven_day_change || null,
      sevenDaySales: data.statistics.seven_day_sales || null,
      sevenDayVolume: data.statistics.seven_day_volume || null,
      thirtyDayAveragePrice: data.statistics.thirty_day_average_price || null,
      thirtyDayChange: data.statistics.thirty_day_change || null,
      thirtyDaySales: data.statistics.thirty_day_sales || null,
      thirtyDayVolume: data.statistics.thirty_day_volume || null,
      totalMinted: data.statistics.total_minted || null,
      totalSales: data.statistics.total_sales || null,
      totalVolume: data.statistics.total_volume || null,
      updatedDate: data.statistics.updated_date || null,
    };
  }

  public async getNFTsSolana(address: string): Promise<TokenBalance[]> {
    const data = await Promise.all(await this.fetchNFTsSolana(address, 1));
    const uniqueTokens = [
      ...new Map(data.map((item) => [item.collectionAddress, item])).values(),
    ];

    const nfts = uniqueTokens.map((item) => {
      const tokens = data.filter(
        (x) => x.collectionAddress === item.collectionAddress,
      );
      let collectionName;
      if (item.collectionName === 'Unknown') {
        const idx = item.name.lastIndexOf('#');
        if (idx !== -1) {
          collectionName = item.name.substring(0, idx);
        } else {
          collectionName = item.name;
        }
      } else {
        collectionName = item.collectionName;
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
            image: nft.imageUrl,
          };
        }),
      };
    });

    return nfts;
  }

  public async getNFTsEthereum(address: string): Promise<TokenBalance[]> {
    try {
      const sdk = this.getNewSdk(NetworkNames.Mainnet);
      const data = await sdk.getNftList({
        account: address,
      });
      return data.items.map((item) => {
        return {
          contractName: item.contractName,
          contractSymbol: item.contractSymbol,
          contractAddress: item.contractAddress.toLowerCase(),
          tokenType: item.tokenType,
          nftVersion: item.nftVersion,
          nftDescription: item.nftDescription,
          balance: +item.balance,
          nfts: item.items.map((nft) => {
            return {
              tokenId: +nft.tokenId,
              name: nft.name,
              amount: nft.amount,
              image: nft.image,
            };
          }),
        };
      });
    } catch {
      this.logger.debug(`error processing address ${address}`);
      return [];
    }
  }

  public async getNFTsPolygon(address: string): Promise<TokenBalance[]> {
    try {
      const sdk = this.getNewSdk(NetworkNames.Matic);
      const data = await sdk.getNftList({
        account: address,
      });
      return data.items.map((item) => {
        return {
          contractName: item.contractName,
          contractSymbol: item.contractSymbol,
          contractAddress: item.contractAddress.toLowerCase(),
          tokenType: item.tokenType,
          nftVersion: item.nftVersion,
          nftDescription: item.nftDescription,
          balance: +item.balance,
          nfts: item.items.map((nft) => {
            return {
              tokenId: +nft.tokenId,
              name: nft.name,
              amount: nft.amount,
              image: nft.image,
            };
          }),
        };
      });
    } catch {
      this.logger.debug(`error processing address ${address}`);
      return [];
    }
  }

  public async getAccountBalanceEth(
    address: string,
  ): Promise<AccountBalanceResponse> {
    try {
      const ethBalance = await this.getEthBalance(address);
      const usd = +(await this.redis.get('ethUsdPrice'));
      const usdBalance = +(usd * ethBalance);

      const data = {
        tokenBalance: ethBalance,
        usdBalance,
      };
      return data;
    } catch {
      return {
        tokenBalance: 0,
        usdBalance: 0,
      };
    }
  }

  public async getAccountBalancePolygon(
    address: string,
  ): Promise<AccountBalanceResponse> {
    try {
      const maticBalance = await this.getMaticBalance(address);
      const usd = +(await this.redis.get('maticUsdPrice'));
      const usdBalance = +(usd * maticBalance);

      const data = {
        tokenBalance: maticBalance,
        usdBalance,
      };
      return data;
    } catch {
      return {
        tokenBalance: 0,
        usdBalance: 0,
      };
    }
  }

  public async getAccountBalanceSol(
    address: string,
  ): Promise<AccountBalanceResponse> {
    try {
      const solBalance = await this.getSolBalance(address);
      const usd = +(await this.redis.get('solUsdPrice'));
      const usdBalance = +(usd * solBalance);

      const data = {
        tokenBalance: solBalance,
        usdBalance,
      };
      return data;
    } catch {
      return {
        tokenBalance: 0,
        usdBalance: 0,
      };
    }
  }

  private getNewSdk(network: NetworkNames): Sdk {
    return new Sdk(this.sdkPrivatKey, {
      networkName: network,
    });
  }

  private async fetchNFTsSolana(address: string, page: number): Promise<any> {
    const response = await this.httpService
      .post(
        SOL_QUICKNODE,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'qn_fetchNFTs',
          params: {
            wallet: address,
            omitFields: ['provenance', 'traits'],
            page,
            perPage: 20,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      .toPromise();
    const data = response.data.result.assets;
    if (response.data.result.totalPages > page && page < 5) {
      return data.concat(
        await Promise.all(await this.fetchNFTsSolana(address, page + 1)),
      );
    }
    return data || [];
  }

  private async getEthBalance(address: string): Promise<number> {
    const response = await this.httpService
      .post(
        ETH_RPC,
        {
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 0,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      .toPromise();

    const data = response.data.result;
    const hexBalance = data;
    const parsed = parseInt(hexBalance, 16);
    const toEther = +this.Web3.utils.fromWei(parsed.toString(), 'ether');
    return toEther;
  }

  private async getMaticBalance(address: string): Promise<number> {
    const maticBalance = await this.httpService
      .get(
        `https://api.polygonscan.com/api?module=account&action=balance&address=${address}&apikey=${process.env.POLYGON_API_KEY}`,
      )
      .toPromise()
      .then((response) => response.data.result);

    const toMatic = maticBalance / 1000000000000000000;
    return toMatic;
  }

  public async solBalance(address: string): Promise<number> {
    return this.getSolBalance(address);
  }

  private async getSolBalance(address: string): Promise<number> {
    const response = await this.httpService
      .post(
        SOL_RPC,
        {
          jsonrpc: '2.0',
          method: 'getBalance',
          params: [address],
          id: 0,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      .toPromise();

    const data = response.data.result?.value || 0;
    const value = parseFloat(data.toString()) / LAMPORTS_PER_SOL;

    return value;
  }

  private fix = (num: any, toFixed: number) =>
    Number(num.toFixed(toFixed).match(/\d+(?:\.\d+)?/)[0]).toFixed(toFixed);

  private getIPFSLink(ipfs: string): string {
    const token = ipfs.substring(ipfs.indexOf('/') + 1, ipfs.length);
    return `https://ipfs.io/ipfs/${token}`;
  }

  private async getSolSupply(address: string): Promise<number> {
    const response = await this.httpService
      .post(
        'https://rpc.ankr.com/solana',
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenSupply',
          params: [address],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      .toPromise();
    return +response.data.result.value.amount;
  }

  private randomIntFromInterval(min, max): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
}
