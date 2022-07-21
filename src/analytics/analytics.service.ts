import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Token, TokenType, Waitlist } from '@prisma/client';
import { HttpService } from '@nestjs/axios';
import {
  HolderInfo,
  TimestampEvent,
  TokenHolder as TokenHolderInternal,
  TokenHoldersResponse
} from './models/token-holders';
import { BalanceResponse } from './models/balances';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { BlockChainEvent, BlockChainUserEvent } from './models/blockchain-events';
import { CollectionStatsAggregateQuery, ZDK } from '@zoralabs/zdk';
import { WhitelistInfoRequest } from './requests/whitelist-info-request';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import path from 'path';
import { WhitelistInfoResponse } from './models/whitelist-info-response';
import { readFileSync } from 'fs';
import papaparse from 'papaparse';
import { getFollowerCount } from 'follower-count';
import {
  CollectionInfoResponse,
  CollectionStats,
  MutualHoldingsResponse,
  TopHoldersResponse,
  WhitelistStatisticsResponse
} from './models/whitelist-statistics-response';
import Redlock from 'redlock';
import { Network } from '@zoralabs/zdk/dist/queries/queries-sdk';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly covalentApiKey = process.env.COVALENT_API_KEY;
  private readonly bitqueryApiKey = process.env.BITQUERY_API_KEY;
  private readonly bigQuery;
  private readonly ZORA_API_ENDPOINT = 'https://api.zora.co/graphql';
  private readonly NFTPORT_API_KEY = process.env.NFTPORT_API_KEY;
  private readonly EtherscanApi = require('etherscan-api').init(
    process.env.ETHERESCAN_API_KEY
  );
  private readonly Moralis = require('moralis/node');
  private readonly web3 = require('web3');
  private readonly ethDater = require('ethereum-block-by-date');
  private readonly zdk: ZDK;
  private readonly ethPrice = require('eth-price');
  private readonly redlock;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @InjectQueue('waitlist') private readonly holdersQueue: Queue
  ) {
    this.web3 = new this.web3(
      new this.web3.providers.HttpProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
      )
    );
    const { BigQuery } = require('@google-cloud/bigquery');
    this.bigQuery = new BigQuery({
      projectId: 'slise-355804',
      keyFilename: path.join(process.cwd(), 'configs/slise-355804-95d4d7714e5a.json')
    });

    this.Moralis.start({
      serverUrl: process.env.MORALIS_SERVER_URL,
      appId: process.env.MORALIS_APP_ID,
      masterKey: process.env.MORALIS_MASTER_KEY
    });

    this.redlock = new Redlock([redis]);

    this.ethDater = new this.ethDater(
      this.web3
    );

    this.zdk = new ZDK({ endpoint: this.ZORA_API_ENDPOINT });
  }

  public async getWhitelists(): Promise<Waitlist[]> {
    const whitelists = await this.prisma.waitlist.findMany({
      where: {
        mainWaitlist: true
      }
    });
    return whitelists;
  }

  public async getWhitelistStatistics(id: string): Promise<WhitelistStatisticsResponse> {
    const existTopHolders = await this.redis.get(`whitelistStatistics ${id}`);
    if (existTopHolders) {
      return JSON.parse(existTopHolders);
    } else {
      const whitelist = await this.prisma.waitlist.findFirst({
        where: {
          id: id
        }
      });
      let whitelistSize: any;
      if (whitelist.size === null) {
        whitelistSize = await this.getWaitlistSize(id);
        await this.prisma.waitlist.update({
          where: {
            id: id
          },
          data: {
            size: whitelistSize
          }
        })
      } else {
        whitelistSize = whitelist.size;
      }
      const [twitterFollowersCount, discordInfo]
        = await Promise.all([
        this.getTwitterFollowersCount(whitelist.twitter),
        this.getDiscordInfo(whitelist.discord)]);

      this.logger.debug('fetching topHolders and mutualHolders');
      const [topHolders, mutualHoldings] = await Promise.all([
        this.prisma.$queryRaw<TopHoldersResponse[]>`select "TokenHolder".address, "TokenHolder"."totalBalanceUsd" as portfolio, count(DISTINCT TT.address) as nfts from "TokenHolder"
        inner join "TokenTransfer" TT on "TokenHolder".id = TT."holderId"
        where "TokenHolder"."waitlistId" = ${id} and "contractType" = 'ERC721'
        group by "TokenHolder".address, portfolio
        order by "TokenHolder"."totalBalanceUsd" desc
        limit 10;`,
        this.prisma.$queryRaw<MutualHoldingsResponse[]>`select DISTINCT "TokenTransfer".address, "TokenTransfer".name, count("TokenTransfer".name) as totalHoldings from "TokenTransfer"
        where "TokenTransfer"."waitlistId" = ${id}  and "TokenTransfer".address <> ${whitelist.contractAddress.toLowerCase()} 
        and "contractType" = 'ERC721'
        group by "TokenTransfer".name, "TokenTransfer".address
        order by totalHoldings desc
        limit 10;`
      ]);

      const whales = 5;
      const bluechipHolders = 48;
      const bots = 318;
      let failed: string[] = [];

      await Promise.all(mutualHoldings.map(async (holding) => {
          try {
            const response = await this.getCollectionInfo(holding.address);
            if (response) {
              holding.holdings = response;
            }
          } catch (e) {
            failed.push(holding.address);
          }
        }
      ));

      mutualHoldings.sort((a, b) => {
        return b.totalholdings - a.totalholdings;
      });

      this.logger.debug('NFT port requests');
      let initPercent = 100;
      let initValue: number;
      mutualHoldings.map((holding, idx) => {
        if (idx === 0) {
          initValue = holding.totalholdings;
          holding.percent = initPercent;
        } else {
          holding.percent = ((holding.totalholdings / initValue) * initPercent);
        }
      });

      if (mutualHoldings.length > 8) {
        await this.redis.set(`${id} mutualHolders`, JSON.stringify(mutualHoldings), 'EX', 60 * 10 * 5);
      }

      this.logger.debug('topHolders processing');
      topHolders.map((holder) => {
        if (holder.portfolio >= 2000000) {
          holder.label = 'whale';
          holder.whale = true;
        } else {
          holder.label = 'mixed';
          holder.whale = false;
        }
        holder.avgNFTPrice = holder.portfolio / holder.nfts;
        holder.nftsTotalPrice = holder.avgNFTPrice * (holder.nfts / 1.5)
        if (holder.nfts > 20 && holder.nfts < 30) {
          holder.holdingTimeLabel = 'mixed'
        } else if (holder.nfts > 30) {
          holder.holdingTimeLabel = 'holder'
        } else {
          holder.holdingTimeLabel = 'flipper'
        }
        holder.tradingVolume = holder.portfolio - holder.avgNFTPrice;
        holder.alsoHold = {
          collectionInfo: this.getMultipleRandom(mutualHoldings, 3),
          total: 16
        }
      });

      if (topHolders.length > 8) {
        await this.redis.set(`${id} topHolders`, JSON.stringify(topHolders), 'EX', 60 * 10 * 5);
      }

      this.logger.debug('complete');

      if (failed.length > 0) {
        this.logger.debug(`${failed} failed parsing mutual holdings`);
      }
      const response: WhitelistStatisticsResponse = {
        bluechipHolders: bluechipHolders,
        bots: bots,
        discordInfo: discordInfo,
        twitterFollowersCount: twitterFollowersCount,
        whales: whales,
        whitelistSize: whitelistSize,
        topHolders: topHolders,
        mutualHoldings: mutualHoldings
      }

      if (response.mutualHoldings.length > 8 && response.topHolders.length > 8) {
        await this.redis.set(`whitelistStatistics ${id}`, JSON.stringify(response), 'EX', 60 * 10);
      }
      return response;
    }
  }

  private getMultipleRandom(arr, num) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());

    return shuffled.slice(0, num);
  }

  public async getTopHolders(id: string): Promise<TopHoldersResponse[]> {
    const existTopHolders = await this.redis.get(`${id} topHolders`)

    if (existTopHolders) {
      return JSON.parse(existTopHolders);
    } else {
      const topHolders = await this.prisma.$queryRaw<TopHoldersResponse[]>`select "TokenHolder".address, "TokenHolder"."totalBalanceUsd" as portfolio, count(DISTINCT TT.address) as nfts from "TokenHolder"
        inner join "TokenTransfer" TT on "TokenHolder".id = TT."holderId"
        where "TokenHolder"."waitlistId" = ${id} and "contractType" = 'ERC721'
        group by "TokenHolder".address, portfolio
        order by "TokenHolder"."totalBalanceUsd" desc
        limit 10;`;

      topHolders.map((holder) => {
        if (holder.portfolio >= 2000000) {
          holder.label = 'whale';
          holder.whale = true;
        } else {
          holder.label = 'mixed';
          holder.whale = false;
        }
        holder.avgNFTPrice = holder.portfolio / holder.nfts;
        holder.nftsTotalPrice = holder.avgNFTPrice * (holder.nfts / 1.5)
        if (holder.nfts > 20 && holder.nfts < 30) {
          holder.holdingTimeLabel = 'mixed'
        } else if (holder.nfts > 30) {
          holder.holdingTimeLabel = 'holder'
        } else {
          holder.holdingTimeLabel = 'flipper'
        }
        holder.tradingVolume = holder.portfolio - holder.avgNFTPrice;
      });

      await this.redis.set(`${id} topHolders`, JSON.stringify(topHolders), 'EX', 60 * 10 * 5);

      return topHolders;
    }
  }

  public async getMutualHoldings(id: string): Promise<MutualHoldingsResponse[]> {
    const existMutualHolders = await this.redis.get(`${id} mutualHolders`);
    if (existMutualHolders) {
      const hm: MutualHoldingsResponse[] = JSON.parse(existMutualHolders);
      await Promise.all(hm.map(async (mutual) => {
        try {
          const collectionStats = await this.getCollectionStats(mutual.address);
          mutual.holdings.stats = collectionStats;
          const totalHolders = await this.fetchHolders(1, mutual.address, 10000);
          if (totalHolders) {
            mutual.totalHolders = totalHolders.items.length;
          }
        } catch {

        }
      }));

      return hm;
    } else {
      const whitelist = await this.prisma.waitlist.findFirst({
        where: {
          id: id
        }
      });
      const mutualHoldings = await this.prisma.$queryRaw<MutualHoldingsResponse[]>`select DISTINCT "TokenTransfer".address, "TokenTransfer".name, count("TokenTransfer".name) as totalHoldings from "TokenTransfer"
        where "TokenTransfer"."waitlistId" = ${id}  and "TokenTransfer".address <> ${whitelist.contractAddress.toLowerCase()} 
        and "contractType" = 'ERC721'
        group by "TokenTransfer".name, "TokenTransfer".address
        order by totalHoldings desc
        limit 10;`;

      let failed: string[] = [];

      await Promise.all(mutualHoldings.map(async (holding) => {
          try {
            const response = await this.getCollectionInfo(holding.address);
            if (response) {
              holding.holdings = response;
            }
            const totalHolders = await this.fetchHolders(1, holding.address, 10000);
            if (totalHolders) {
              holding.totalHolders = totalHolders.items.length;
            }
          } catch (e) {
            failed.push(holding.address);
          }
        }
      ));

      mutualHoldings.sort((a, b) => {
        return b.totalholdings - a.totalholdings;
      });

      this.logger.debug('NFT port requests');
      let initPercent = 100;
      let initValue: number;
      mutualHoldings.map((holding, idx) => {
        if (idx === 0) {
          initValue = holding.totalholdings;
          holding.percent = initPercent;
        } else {
          holding.percent = ((holding.totalholdings / initValue) * initPercent);
        }
      });

      await this.redis.set(`${id} mutualHolders`, JSON.stringify(mutualHoldings), 'EX', 60 * 10 * 5);

      return mutualHoldings;
    }

  }

  public async fetchNewBalances(address: string): Promise<any> {
    try {
      const options = {
        address: address
      };
      const ethBalance = await this.Moralis.Web3API.account.getNativeBalance(options);
      const usdBalance = (await this.ethPrice('usd'))[0];
      const usd = +(usdBalance.substr(5, usdBalance.length));
      const ethB = +(this.web3.utils.fromWei(ethBalance.balance, 'ether'));
      const usdB = +((+usd) * ethB);

      const data = {
        ethBalance: ethB,
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

  public async getTokens(): Promise<Token[]> {
    const a = await this.getTokensByAddresses(['0x566ac1ca3ebb8c157f2c0b3f9fd1f7ce5fbec45e']);
    const b = a;
    /*const a = await this.getTwitterFollowersCount('acecreamu');*/

    /*  const balance = await this.Moralis.Web3API.account.getTokenBalances(options);
      const a = balance;*/
    //const hldrs = await this.fetchHolders(1, '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', 10000);
    /*const a = await this.getTokensByAddresses(['0x8ba525b1e98735d24417ae324a9709b2396fa7c8']);
    const b = a;*/
    //const a = await this.getTokensByAddresses(['0x7525e71f51bda1fbc326000714d2fc68ed5aed6b']);
    /* const query = 'SELECT address FROM `bigquery-public-data.crypto_ethereum.balances` LIMIT 1';
     const options = {
       query: query,
       // Location must match that of the dataset(s) referenced in the query.
       location: 'US',
     };

     // Run the query as a job
     const job = await this.bigQuery.createQueryJob(options);
     console.log(`Job ${job.id} started.`);

     // Wait for the query to finish
     const rows = await job.getQueryResults();*/

    //const hldrs = await this.fetchHolders(1, '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', 6439);
    //const a = await this.eventsByAddress('0x59728544b08ab483533076417fbbb2fd0b17ce3a', '2022-05-17T21:04:55Z', '2022-06-17T21:04:55Z', 10000, 1);

    const tokens = await this.prisma.token.findMany();
    //const a = await this.fetchEventsByContractsAndAddresses(["0x026224A2940bFE258D0dbE947919B62fE321F042", "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b"], ["0x3058a0d5e8e1a7b15dbf13eb3d411ee3efea70d9"]);
    return tokens;
  }

  public async tokenHoldersFromSource(network: number, token: string, pageSize: number): Promise<TokenHolderInternal[]> {
    const holders = await this.fetchTokenHolders(network, token, pageSize);

    return holders;
  }

  public async eventsByContractsAndAddresses(contractAddresses: string[], addresses: string[]): Promise<BlockChainUserEvent[]> {
    this.logger.debug(`search for events by addresses ${addresses}`);
    return await this.fetchEventsByContractsAndAddresses(contractAddresses, addresses);
  }

  public async parseHolders(request: WhitelistInfoRequest): Promise<string> {
    this.logger.debug(`collection: ${request.collectionName} received for processing`);
    const hldrs = await this.fetchHolders(1, request.contractAddress, 10000);
    const addresses = hldrs.items.map((item) => {
      return item.address;
    });
    const waitlist = await this.prisma.waitlist.create({
      data: {
        name: request.collectionName,
        contractAddress: request.contractAddress.toLowerCase()
      }
    });
    const holdersRequest = {
      addresses: addresses,
      waitlistId: waitlist.id
    };
    const job = await this.holdersQueue.add('parseAndStore', {
      holdersRequest
    });
    this.logger.debug(`collection: ${request.collectionName} will be processed with jobId: ${job.id}`);
    return waitlist.id;
    /*const chunkSize = 20;
    for (let i = 0; i < holdersRequest.addresses.length; i += chunkSize) {
      const chunk = holdersRequest.addresses.slice(i, i + chunkSize);
      const holders: HolderInfoRequest = {
        addresses: chunk,
        collectionName: holdersRequest.collectionName,
        contractAddress: holdersRequest.contractAddress
      }
      const job = await this.holdersQueue.add('parseAndStore', {
        holders
      }, {});
      this.logger.debug(`collection: ${holdersRequest.collectionName} will be processed with jobId: ${job.id}`);
    }*/
  }

  public async storeWaitlist(waitlistRequest: WhitelistInfoRequest, file: Express.Multer.File): Promise<WhitelistInfoResponse> {
    this.logger.debug(`collection: ${waitlistRequest.collectionName} received for processing`);
    //const hldrs = await this.fetchHolders(1, waitlistRequest.contractAddress, waitlistRequest.waitlistSize);
    /* const addresses = hldrs.items.map((item) => {
       return item.address;
     });*/
    const csvFile = readFileSync(`uploads/${file.filename}`);
    const parsedCsv = await papaparse.parse(csvFile.toString(), {
      header: false,
      skipEmptyLines: true,
      complete: (results) => results.data
    });
    //TODO: change to map in map
    let addresses: string[] = [];
    parsedCsv.data.map((subarray) => subarray.map((address) => {
      addresses.push(address);
    }));
    const waitlist = await this.prisma.waitlist.create({
      data: {
        name: waitlistRequest.collectionName,
        contractAddress: waitlistRequest.contractAddress,
        mainWaitlist: false
      }
    });
    const holdersRequest = {
      addresses: addresses,
      waitlistId: waitlist.id
    };
    const job = await this.holdersQueue.add('parseAndStore', {
      holdersRequest
    });
    this.logger.debug(`collection: ${holdersRequest.waitlistId} will be processed with jobId: ${job.id}`);
    return {
      contractAddress: waitlist.contractAddress,
      id: waitlist.id
    };
  }

  public async tokenEventsByContract(network: number, token: string, pageSize: number): Promise<BlockChainUserEvent[]> {
    let holders: TokenHolderInternal[] = [];

    // const cachedHolders = await this.redis.get(`${token}:holders`);
    // if (cachedHolders) {
    //     holders = JSON.parse(cachedHolders);
    // }
    // else {
    //     try {
    //         holders = await this.fetchTokenHolders(network, token, pageSize);
    //     }
    //     catch (e) {
    //         const error = e.toString();
    //         this.logger.log(
    //             `Error fetching token holders: ${JSON.stringify({ token, error })}`,
    //         );
    //     }
    // }

    holders = await this.fetchTokenHolders(network, token, pageSize);

    this.logger.debug(`fetched holders count ${holders.length}`);

    const defaultContracts: string[] = ['0x026224A2940bFE258D0dbE947919B62fE321F042', '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b', '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9'];
    const events = await this.fetchEventsByContractsAndHolders(defaultContracts, holders);

    return events;
  }

  public async tokenHolders(network: number, token: string, pageSize: number): Promise<TokenHolderInternal[]> {
    let holders: TokenHolderInternal[] = [];
    holders = await this.fetchTokenHolders(network, token, pageSize);

    const addresses = holders.map((holder) => {
      return holder['address'];
    });

    const data = await this.getTokensByAddresses(addresses);
    //const data = await this.fetchZora(addresses);
    // const cachedHolders = await this.redis.get(`${token}:holders`);
    // if (cachedHolders) {
    //     holders = JSON.parse(cachedHolders);
    // }
    // else {
    //     try {
    //         holders = await this.fetchTokenHolders(network, token, pageSize);
    //     }
    //     catch (e) {
    //         const error = e.toString();
    //         this.logger.log(
    //             `Error fetching token holders: ${JSON.stringify({ token, error })}`,
    //         );
    //     }
    // }

    return holders;
  }

  public async fetchTokenHolders(network: number, token: string, pageSize: number): Promise<TokenHolderInternal[]> {
    const holders = await this.fetchHolders(network, token, pageSize);

    //await this.fetchBalances(network, holders.items[1].address);

    const response: TokenHolderInternal[] = await Promise.all(
      holders.items.map(async (item) => ({
        address: item.address,
        amount: +item.balance,
        first_transfer: 1,
        total_balance_usd: 0//(await this.fetchBalances(network, item.address)).items[0].quote
      }))
    );

    return response;
  }

  public async tokenHoldersBetweenDates(network: number, token: string, pageSize: number, startDate: string, endDate: string, period: string): Promise<TimestampEvent[]> {
    const blocks = await this.ethDater.getEvery(
      period, // Period, required. Valid value: years, quarters, months, weeks, days, hours, minutes
      startDate, // Start date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
      endDate, // End date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
      1, // Duration, optional, integer. By default 1.
      true, // Block after, optional. Search for the nearest block before or after the given date. By default true.
      false // Refresh boundaries, optional. Recheck the latest block before request. By default false.
    );

    //const holderO = await this.fetchHoldersByBlocks(network, token, pageSize, blocks[0].block);

    const holders: TokenHoldersResponse[] = await Promise.all(blocks.map(async (block) => {
      return await this.fetchHoldersByBlocks(network, token, pageSize, block.block);
    }));

    const initTotalSuply = 0;
    const stats: TimestampEvent[] = await Promise.all(holders.map(async (holder, idx) => {
      const totalSuply = holder.items.reduce((accumulator, item) => accumulator + (+item.total_supply), initTotalSuply);
      // const amounts = await Promise.all(holder.items.map(async (item) => {
      //     return (await this.fetchBalances(network, item.address)).items[0].quote;
      // }));
      //const totalAmount = amounts.reduce((prev, cur) => prev + cur);

      const totalAmount = 0;
      const totalHolders = holder.items.length;

      return {
        totalSuply: totalSuply,
        totalAmount: totalAmount,
        totalHolders: totalHolders,
        timestamp: blocks[idx].date
      };
    }));

    // const cacheStats = await this.redis.get(`${token}:holdersStats`);

    // if(!cacheStats){
    //     await this.redis.set(`${token}:holdersStats`, JSON.stringify(stats));
    // }
    return stats;
  }

  private async fetchHoldersByBlocks(network: number, token: string, pageSize: number, block: number): Promise<TokenHoldersResponse> {
    const url = `https://api.covalenthq.com/v1/${network}/tokens/${token}/token_holders/?block-height=${block}&quote-currency=USD&format=JSON&key=${this.covalentApiKey}&page-number=0&page-size=${pageSize}`;

    const response = await this.httpService.get(url).toPromise();

    const data = response.data.data;
    return data;
  }

  private async fetchHoldersBetweenBlocks(network: number, token: string, pageSize: number, startBlock: number, endBlock: number): Promise<TokenHoldersResponse> {
    const url = `https://api.covalenthq.com/v1/${network}/tokens/${token}/token_holders_changes/?starting-block=${startBlock}&ending-block=${endBlock}&quote-currency=USD&format=JSO&key=${this.covalentApiKey}&page-number=0&page-size=${pageSize}`;

    const response = await this.httpService.get(url).toPromise();

    const data = response.data.data;
    return data;
  }

  private async fetchHolders(network: number, token: string, pageSize: number): Promise<TokenHoldersResponse> {
    const url = `https://api.covalenthq.com/v1/${network}/tokens/${token}/token_holders/?` +
      `quote-currency=USD&format=JSON&key=${this.covalentApiKey}&page-number=0&page-size=${pageSize}`;

    const response = await this.httpService.get(url).toPromise();

    const data = response.data.data;
    return data;
  }

  public async fetchBalances(network: number, address: string): Promise<BalanceResponse> {
    const pageSize = 100000;
    const withNFTs = false; // API endpoint not working with NFTs
    const url = `https://api.covalenthq.com/v1/${network}/address/${address}/balances_v2/?` +
      `quote-currency=USD&format=JSON&nft=${withNFTs}&no-nft-fetch=true&key=${this.covalentApiKey}&page-number=0&page-size=${pageSize}`;

    const response = await this.httpService.get(url).toPromise();

    return response.data.data;
  }

  public async eventsByAddress(contractAddress: string, startDate: string, endDate: string, pageSize: number, page: number): Promise<any> {
    const blocks = await this.ethDater.getEvery(
      'weeks', // Period, required. Valid value: years, quarters, months, weeks, days, hours, minutes
      startDate, // Start date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
      endDate, // End date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
      1, // Duration, optional, integer. By default 1.
      true, // Block after, optional. Search for the nearest block before or after the given date. By default true.
      false // Refresh boundaries, optional. Recheck the latest block before request. By default false.
    );
    //14794782 14963846
    const NETWORK = 'ethereum';
    const event = this.getEventByAddress(contractAddress);
    const fromBlock = blocks[0].block;
    const toBlock = blocks[blocks.length - 1].block;

    const response = await this.httpService.post('https://graphql.bitquery.io/', {
      query: `
                query ($network: EthereumNetwork!,$contract: String!,$event: String!, $fromBlock: Int!, $toBlock: Int!, $limit: Int!, $offset: Int!) {\n  ethereum(network: $network) {\n    smartContractEvents(\n      options: {asc: \"block.height\", limit: $limit, offset: $offset}\n      smartContractEvent: {is: $event }\n      smartContractAddress: {is: $contract}\n      height: {gteq: $fromBlock, lt: $toBlock }\n    ) {\n      block {\n        height\n        timestamp {\n          iso8601\n          unixtime\n        }\n      }\n      transaction {\n        hash\n      }\n      arguments {\n        value\n        argument\n      }\n    }\n  }\n}\n,`,
      variables: {
        network: NETWORK,
        contract: `${contractAddress}`,
        event: `${event}`,
        fromBlock: fromBlock,
        toBlock: toBlock,
        limit: +pageSize,
        offset: +(pageSize * page)
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.bitqueryApiKey
      }
    }).toPromise();

    const data = response.data.data.ethereum.smartContractEvents;

    return data;
  }

  public async getAddressStats(address: string): Promise<any> {
    const kazm = 'https://us-central1-kazm-flashlight-dev.cloudfunctions.net/getAddressStats';
    const response = await this.httpService.post(kazm, {
        'data': {
          'address': `${address}`
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }).toPromise();

    return response.data.result;
  }

  public async getNFTsTransfers(address: string, continuation?: string): Promise<any> {

    let query = `https://api.nftport.xyz/v0/transactions/accounts/${address}?chain=ethereum&type=all`;
    if (continuation !== undefined) {
      query += `&continuation=${continuation}`;
    }
    const response = await this.httpService.get(query, {
      headers: {
        'Authorization': `${this.NFTPORT_API_KEY}`
      }
    }).toPromise();

    const data = response.data;
    return data;
  }

  public async getCollectionInfo(address: string): Promise<CollectionInfoResponse> {
    const query = `https://api.nftport.xyz/v0/nfts/${address}?chain=ethereum&page_number=1&page_size=1&include=all&refresh_metadata=true`;

    const response = await this.httpService.get(query, {
      headers: {
        'Authorization': `${this.NFTPORT_API_KEY}`
      }
    }).toPromise();

    const data = response.data;
    //const collectionStats = await this.getCollectionStats(address);
    let result: CollectionInfoResponse = {
      totalSupply: data.total || 0,
      logo: data.contract.metadata.thumbnail_url
    }
    // if(collectionStats) {
    //  result.stats = collectionStats;
    // }
    return result;
  }

  public async getCollectionStats(address: string): Promise<CollectionStats> {
    const query = `https://api.nftport.xyz/v0/transactions/stats/${address}?chain=ethereum`;

    const response = await this.httpService.get(query, {
      headers: {
        'Authorization': `${this.NFTPORT_API_KEY}`
      }
    }).toPromise();

    const data = response.data;
    return {
      floor: data.statistics.floor_price || 0,
      supply: data.statistics.total_supply || 0,
      mintPrice: data.statistics.floor_price / 5.2 || 0
    }
  }

  public async getTokensByAddresses(addresses: string[]): Promise<HolderInfo[]> {
    const response = await this.httpService.post('https://graphql.bitquery.io/', {
      query: `
            query ($network: EthereumNetwork!, $addresses: [String!]) {
              ethereum(network: $network) {
                address(address: {in: $addresses}) {
                   balances {
                    value
                    currency {
                      tokenId
                      tokenType
                      address
                      symbol
                      name
                    }
                  }
                  address
                }
              }
            }`,
      variables: {
        network: 'ethereum',
        addresses: addresses
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.bitqueryApiKey
      }
    }).toPromise();

    return response.data.data.ethereum.address;
  }

  public async getNFTsByAddress(address: string): Promise<any> {
    const options = {
      chain: 'eth',
      address: address
    };
    const NFTs = await this.Moralis.Web3API.account.getNFTTransfers(options);
    return NFTs;
  }

  private getEventByAddress(address: string): string {
    let event = null;
    switch (address) {
      case '0x59728544b08ab483533076417fbbb2fd0b17ce3a':
        event = 'TakerBid';
        break;
      case '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b':
        event = 'OrdersMatched';
        break;
      default:
        throw new NotFoundException('address not found');
    }

    return event;
  }

  private getEventFromByAddress(address: string): string {
    let event = null;
    switch (address) {
      case '0x59728544b08ab483533076417fbbb2fd0b17ce3a':
        event = 'LooksRare';
        break;
      case '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b':
        event = 'Opensea';
        break;
      case '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9':
        event = 'AAVE V2';
        break;
      default:
        event = address;
    }

    return event;
  }

  private getEventTypeByEventName(event: string): string {
    let type = null;
    switch (event) {
      case 'OrdersMatched':
        type = 'Sale';
        break;
      case 'OrderCancelled':
        type = 'Order Cancelled';
        break;
      case 'ApprovalForAll':
        type = 'Approval For All';
        break;
      case 'Approval':
        type = 'Sale';
        break;
      case 'Transfer':
        type = 'Mint';
        break;
      default:
        type = event;
    }

    return type;
  }

  private async fetchEventsByContractsAndAddresses(contractAddresses: string[], addresses: string[]): Promise<BlockChainUserEvent[]> {
    const response = await this.httpService.post('https://graphql.bitquery.io/', {
      query: `
            query ($contractAddress: [String!], $addresses: [String!]) {
                ethereum {
                  smartContractEvents(
                    options: {asc:"transaction.txFrom.address", desc: "block.timestamp.unixtime"}
                    smartContractAddress: {in: $contractAddress}
                    txFrom: {in: $addresses}
                  ) {
                     smartContractEvent {
                      name
                    }
                    transaction{
                        hash
                        txFrom{
                            address
                        }
                    }
                    arguments{
                      argument
                      value
                    }
                    block{
                      timestamp{
                        iso8601
                        unixtime
                      }
                    }
                    smartContract{
                        address{
                          address
                        }
                      }
                  }
                }
              }
              `,
      variables: {
        contractAddress: contractAddresses,
        addresses: addresses
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.bitqueryApiKey
      }
    }).toPromise();

    const data = response.data.data.ethereum.smartContractEvents;

    const events: BlockChainEvent[] = data.map((event) => {
      const txfrom = event.arguments.find((arg) => {
        return arg.argument === 'owner';
      });
      const txto = event.arguments.find((arg) => {
        return arg.argument === 'spender';
      });
      const eventFrom = this.getEventFromByAddress(event.smartContract.address.address.toLowerCase());
      const from = eventFrom === event.smartContract.address.address.toLowerCase() ? 'Smart Contract Event' : eventFrom;

      return {
        txHash: event.transaction.hash.toLowerCase(),
        txFrom: event.transaction.txFrom.address.toLowerCase(),
        txTo: txto !== undefined ? txto.value : '',
        timestamp: event.block.timestamp.iso8601,
        eventName: event.smartContractEvent.name,
        eventFrom: from,
        metadata: '',
        eventType: this.getEventTypeByEventName(event.smartContractEvent.name),
        smartContractAddress: event.smartContract.address.address.toLowerCase()
      };
    });

    const userEvents: BlockChainUserEvent[] = addresses.map((address) => {
      const eventsByUser = events.filter((event) => {
        return event.txFrom === address.toLowerCase();
      });
      return {
        address: address,
        events: eventsByUser,
        total: eventsByUser.length,
        amount: 0,
        total_balance_usd: 0
      };
    });

    return userEvents;
  }

  private async fetchEventsByContractsAndHolders(contractAddresses: string[], holders: TokenHolderInternal[]): Promise<BlockChainUserEvent[]> {
    const addresses: string[] = holders.map((holder) => {
      return holder['address'];
    });
    const response = await this.httpService.post('https://graphql.bitquery.io/', {
      query: `
            query ($contractAddress: [String!], $addresses: [String!]) {
                ethereum {
                  smartContractEvents(
                    options: {asc:"transaction.txFrom.address", desc: "block.timestamp.unixtime"}
                    smartContractAddress: {in: $contractAddress}
                    txFrom: {in: $addresses}
                  ) {
                     smartContractEvent {
                      name
                    }
                    transaction{
                        hash
                        txFrom{
                            address
                        }
                    }
                    arguments{
                      argument
                      value
                    }
                    block{
                      timestamp{
                        iso8601
                        unixtime
                      }
                    }
                    smartContract{
                        address{
                          address
                        }
                      }
                  }
                }
              }
              `,
      variables: {
        contractAddress: contractAddresses,
        addresses: addresses
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.bitqueryApiKey
      }
    }).toPromise();

    const data = response.data.data.ethereum.smartContractEvents;

    const events: BlockChainEvent[] = data.map((event) => {
      const txto = event.arguments.find((arg) => {
        return arg.argument === 'spender';
      });
      const eventFrom = this.getEventFromByAddress(event.smartContract.address.address.toLowerCase());
      const from = eventFrom === event.smartContract.address.address.toLowerCase() ? 'Smart Contract Event' : eventFrom;

      return {
        txHash: event.transaction.hash.toLowerCase(),
        txFrom: event.transaction.txFrom.address.toLowerCase(),
        txTo: txto !== undefined ? txto.value : '',
        timestamp: event.block.timestamp.iso8601,
        eventName: event.smartContractEvent.name,
        eventFrom: from,
        metadata: '',
        eventType: this.getEventTypeByEventName(event.smartContractEvent.name),
        smartContractAddress: event.smartContract.address.address.toLowerCase()
      };
    });

    const userEvents: BlockChainUserEvent[] = holders.map((holder) => {
      const eventsByUser = events.filter((event) => {
        return event.txFrom === holder.address.toLowerCase();
      });
      return {
        address: holder.address,
        amount: holder.amount,
        total_balance_usd: holder.total_balance_usd,
        events: eventsByUser,
        total: eventsByUser.length
      };
    });

    return userEvents;
  }

  private async getNFTs(address: string): Promise<number> {
    const options = {
      address: address,
    };
    const NFTs = await this.Moralis.Web3API.account.getNFTs(options);
    return NFTs.total;
  }

  private async fetchTotalSupply(address: string): Promise<number> {
    const args: CollectionStatsAggregateQuery = {
      collectionAddress: address,
      network: {
        network: Network.Ethereum
      }
    };

    const response = await this.zdk.collectionStatsAggregate(args);
    return 0;
  }

  private async getWaitlistSize(id: string): Promise<number> {
    const count = await this.prisma.tokenHolder.count({
      where: {
        waitlistId: id
      }
    });
    return count;
  }

  private async getTwitterFollowersCount(link: string): Promise<any> {
    if (link) {
      const username = link.substring(link.lastIndexOf(`/`) + 1, link.length);
      const countByApi = await getFollowerCount({
        type: 'twitter',
        username: username
      });

      return countByApi;
    }
    return null;
  }

  private async getDiscordInfo(link: string): Promise<any> {
    if (link) {
      const code = link.substring(link.lastIndexOf(`/`) + 1, link.length);
      const response = await this.httpService.get(`https://discord.com/api/v9/invites/${code}?with_counts=true&with_expiration=true`).toPromise();

      return {
        name: response.data.guild.name,
        approximateMemberCount: response.data.approximate_member_count,
        premiumSubscriptionCount: response.data.guild.premium_subscription_count
      };
    }
    return null;
  }
}