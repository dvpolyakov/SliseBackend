import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Token } from '@prisma/client';
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
import { WhitelistInfoRequest } from './requests/whitelist-info-request';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import path from 'path';
import { WhitelistInfoResponse } from './models/whitelist-info-response';
import {
  CollectionInfoResponse,
  CollectionStats,
  MutualHoldingsResponse, TargetingResponse,
  TopHoldersDashboardResponse,
  TopHoldersResponse,
  WhitelistStatisticsResponse
} from './models/whitelist-statistics-response';
import { PersistentStorageService } from '../persistentstorage/persistentstorage.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import Enumerable from 'linq';
import papaparse from 'papaparse';
import { TokenBalance } from './models/token-info';
import { IntegraionService } from '../integration/integration.service';
import { mapTokenType } from '../utils/token-mapper';
import { AuthWhitelistMember } from './requests/whitelist-request';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly covalentApiKey = process.env.COVALENT_API_KEY;
  private readonly bitqueryApiKey = process.env.BITQUERY_API_KEY;
  private readonly NFTPORT_API_KEY = process.env.NFTPORT_API_KEY;
  private readonly EtherscanApi = require('etherscan-api').init(
    process.env.ETHERESCAN_API_KEY
  );
  private readonly Moralis = require('moralis/node');
  private readonly web3 = require('web3');
  private readonly ethDater = require('ethereum-block-by-date');
  private readonly ethPrice = require('eth-price');

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @InjectQueue('waitlist') private readonly holdersQueue: Queue,
    private readonly storage: PersistentStorageService,
    private readonly blockchainService: BlockchainService,
    private readonly integrationService: IntegraionService,
  ) {
    this.web3 = new this.web3(
      new this.web3.providers.HttpProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
      )
    );

    this.Moralis.start({
      serverUrl: process.env.MORALIS_SERVER_URL,
      appId: process.env.MORALIS_APP_ID,
      masterKey: process.env.MORALIS_MASTER_KEY
    });

    this.ethDater = new this.ethDater(
      this.web3
    );
  }

  public async test(): Promise<any> {
    const a = await this.blockchainService.test();
    return a;
  }

  public async authWhitelistMember(request: AuthWhitelistMember): Promise<string> {
    //TODO: whitelist id validation
    //TODO: address validation

    const holderAddress = request.address.toLowerCase();
    const tokenBalance = await this.blockchainService.getNFTs(holderAddress);
    const accountBalance = await this.blockchainService.getAccountBalance(holderAddress);
    const totalNFTs = tokenBalance.reduce((accumulator, item) => accumulator + item.balance, 0);

    await this.prisma.$transaction(async () => {
      const whitelistMember = await this.prisma.whitelistMember.create({
        data: {
          address: request.address,
          ethBalance: accountBalance.ethBalance,
          usdBalance: accountBalance.usdBalance,
          totalTokens: totalNFTs,
          whitelistId: request.whitelistId,
          tokenProcessedAttemps: 0
        }
      });
      const fetchedTokens = tokenBalance.map((token) => {
        return {
          contractAddress: token.contractAddress,
          balance: token.balance,
          contractName: token.contractName,
          nftDescription: token.nftDescription,
          nftVersion: token.nftVersion,
          tokenType: mapTokenType(token.tokenType.toUpperCase()),
          whitelistMemberId: whitelistMember.id,
          items: JSON.stringify(token.nfts)
        }
      });
      const tokens = await this.prisma.token.createMany({
        data: fetchedTokens
      });

      if (!(fetchedTokens.length > 0)) {
        await this.prisma.whitelistMember.update({
          where: {
            id: whitelistMember.id
          },
          data: {
            tokenProcessed: false,
            tokenProcessedAttemps : whitelistMember.tokenProcessedAttemps + 1
          }
        })
      }
      this.logger.debug(`${request.address} stored`);
    });


    return request.address;
  }

  // public async getWhitelists(): Promise<Waitlist[]> {
  //   const whitelists = await this.prisma.waitlist.findMany({
  //     where: {
  //       mainWaitlist: true
  //     }
  //   });
  //   return whitelists;
  // }

  // public async getWhitelistStatistics(id: string): Promise<WhitelistStatisticsResponse> {
  //   const existTopHolders = await this.redis.get(`whitelistStatistics ${id}`);
  //   if (existTopHolders) {
  //     return JSON.parse(existTopHolders);
  //   } else {
  //     const whitelist = await this.prisma.waitlist.findFirst({
  //       where: {
  //         id: id
  //       }
  //     });
  //     let whitelistSize: any;
  //     if (whitelist.size === null) {
  //       whitelistSize = await this.getWaitlistSize(id);
  //       await this.prisma.waitlist.update({
  //         where: {
  //           id: id
  //         },
  //         data: {
  //           size: whitelistSize
  //         }
  //       })
  //     } else {
  //       whitelistSize = whitelist.size;
  //     }
  //     const [twitterFollowersCount, discordInfo]
  //       = await Promise.all([
  //         this.integrationService.getTwitterFollowersCount(whitelist.twitter),
  //         this.integrationService.getDiscordInfo(whitelist.discord)]);

  //     this.logger.debug('fetching topHolders and mutualHolders');
  //     const [topHolders, mutualHoldings] = await Promise.all([
  //       this.prisma.$queryRaw<TopHoldersResponse[]>`select "TokenHolder".address, "TokenHolder"."totalBalanceUsd" as portfolio, count(DISTINCT TT.address) as nfts from "TokenHolder"
  //       inner join "TokenTransfer" TT on "TokenHolder".id = TT."holderId"
  //       where "TokenHolder"."waitlistId" = ${id} and "contractType" = 'ERC721'
  //       group by "TokenHolder".address, portfolio
  //       order by "TokenHolder"."totalBalanceUsd" desc
  //       limit 10;`,
  //       this.prisma.$queryRaw<MutualHoldingsResponse[]>`select DISTINCT "TokenTransfer".address, "TokenTransfer".name, count("TokenTransfer".name) as totalHoldings from "TokenTransfer"
  //       where "TokenTransfer"."waitlistId" = ${id}  and "TokenTransfer".address <> ${whitelist.contractAddress?.toLowerCase() ?? ''} and lower("TokenTransfer".address) <> '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85'
  //       and "contractType" = 'ERC721'
  //       group by "TokenTransfer".name, "TokenTransfer".address
  //       order by totalHoldings desc
  //       limit 10;`
  //     ]);

  //     const whales = whitelist.whales ?? +((whitelist.size / 5).toFixed(0));
  //     const bluechipHolders = whitelist.bluechipHolders ?? +((whitelist.size / 7).toFixed(0));
  //     const bots = whitelist.bots ?? +((whitelist.size / 2).toFixed(0));
  //     let failed: string[] = [];

  //     await Promise.all(mutualHoldings.map(async (holding) => {
  //       try {
  //         const response = await this.getCollectionInfo(holding.address);
  //         if (response) {
  //           holding.holdings = response;
  //         }
  //       } catch (e) {
  //         failed.push(holding.address);
  //       }
  //     }
  //     ));

  //     mutualHoldings.sort((a, b) => {
  //       return b.totalholdings - a.totalholdings;
  //     });

  //     this.logger.debug('NFT port requests');
  //     let initPercent = 100;
  //     let initValue: number;
  //     mutualHoldings.map((holding, idx) => {
  //       if (idx === 0) {
  //         initValue = holding.totalholdings;
  //         holding.percent = initPercent;
  //       } else {
  //         holding.percent = ((holding.totalholdings / initValue) * initPercent);
  //       }
  //     });

  //     if (mutualHoldings.length > 8) {
  //       await this.redis.set(`${id} mutualHolders`, JSON.stringify(mutualHoldings));
  //     }

  //     this.logger.debug('topHolders processing');
  //     topHolders.map((holder) => {
  //       if (holder.portfolio >= 2000000) {
  //         holder.label = 'whale';
  //         holder.whale = true;
  //       } else {
  //         holder.label = 'mixed';
  //         holder.whale = false;
  //       }
  //       holder.avgNFTPrice = holder.portfolio / holder.nfts;
  //       holder.nftsTotalPrice = holder.avgNFTPrice * (holder.nfts / 1.5)
  //       if (holder.nfts > 10 && holder.nfts < 25) {
  //         holder.holdingTimeLabel = 'mixed'
  //       } else if (holder.nfts < 10) {
  //         holder.holdingTimeLabel = 'holder'
  //       } else {
  //         holder.holdingTimeLabel = 'flipper'
  //       }
  //       holder.tradingVolume = holder.portfolio - holder.avgNFTPrice;
  //       holder.alsoHold = {
  //         collectionInfo: this.getMultipleRandom(mutualHoldings, 3),
  //         total: 16
  //       }
  //     });

  //     const topHoldersDashboard: TopHoldersDashboardResponse = {
  //       topHolders: topHolders,
  //       bots: whitelist.bots,
  //       bluechipHolders: whitelist.bluechipHolders,
  //       whales: whitelist.whales,
  //       size: whitelistSize
  //     }

  //     if (topHolders.length > 8) {
  //       await this.redis.set(`${id} topHolders`, JSON.stringify(topHoldersDashboard));
  //     }

  //     this.logger.debug('complete');

  //     if (failed.length > 0) {
  //       this.logger.debug(`${failed} failed parsing mutual holdings`);
  //     }
  //     const response: WhitelistStatisticsResponse = {
  //       bluechipHolders: bluechipHolders,
  //       bots: bots,
  //       discordInfo: discordInfo,
  //       twitterFollowersCount: twitterFollowersCount,
  //       whales: whales,
  //       whitelistSize: whitelistSize,
  //       topHolders: topHolders,
  //       mutualHoldings: mutualHoldings
  //     }

  //     if (response.mutualHoldings.length > 8 && response.topHolders.length > 8) {
  //       await this.redis.set(`whitelistStatistics ${id}`, JSON.stringify(response));
  //     }
  //     return response;
  //   }
  // }

  private getMultipleRandom(arr, num) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());

    return shuffled.slice(0, num);
  }

  public async getTargets(vector: number): Promise<number> {
    const result = await this.prisma.$queryRaw<any>`select count(*) from "TargetingHolders" where vector <= cast(${vector}::text as double precision)`;
    return result[0].count;
  }

  public async exportTargets(vector: number): Promise<TargetingResponse> {
    const result = await this.prisma.$queryRaw<any>`select address from "TargetingHolders" 
    inner join "TokenHolder" TH on TH.id = "TargetingHolders"."holderId" 
    where vector <= cast(${vector}::text as double precision)`;


    return {
      address: result
    };
  }

  public async getTopHolders(id: string): Promise<TopHoldersDashboardResponse> {
    // const existTopHolders = await this.redis.get(`${id} topHolders`)
    // if (existTopHolders) {
    return JSON.parse(await this.redis.get(`${id} topHolders`));
    //   } else {
    //     const topHolders = await this.prisma.$queryRaw<TopHoldersResponse[]>`select "TokenHolder".address, "TokenHolder"."totalBalanceUsd" as portfolio, count(DISTINCT TT.address) as nfts from "TokenHolder"
    //       inner join "TokenTransfer" TT on "TokenHolder".id = TT."holderId"
    //       where "TokenHolder"."waitlistId" = ${id} and "contractType" = 'ERC721'
    //       group by "TokenHolder".address, portfolio
    //       order by "TokenHolder"."totalBalanceUsd" desc
    //       limit 10;`;

    //     const whitelist = await this.prisma.waitlist.findFirst({
    //       where: {
    //         id: id
    //       }
    //     });
    //     const existMutualHolders = await this.redis.get(`${id} mutualHolders`);
    //     let hm: MutualHoldingsResponse[];
    //     if (existMutualHolders) {
    //       hm = JSON.parse(existMutualHolders);
    //     }

    //     topHolders.map((holder) => {
    //       if (holder.portfolio >= 2000000) {
    //         holder.label = 'whale';
    //         holder.whale = true;
    //       } else {
    //         holder.label = 'mixed';
    //         holder.whale = false;
    //       }
    //       holder.avgNFTPrice = holder.portfolio / holder.nfts;
    //       holder.nftsTotalPrice = holder.avgNFTPrice * (holder.nfts / 1.5)
    //       if (holder.nfts > 20 && holder.nfts < 30) {
    //         holder.holdingTimeLabel = 'mixed'
    //       } else if (holder.nfts > 30) {
    //         holder.holdingTimeLabel = 'holder'
    //       } else {
    //         holder.holdingTimeLabel = 'flipper'
    //       }
    //       holder.tradingVolume = holder.portfolio - holder.avgNFTPrice;
    //       if (hm) {
    //         holder.alsoHold = {
    //           collectionInfo: this.getMultipleRandom(hm, 3),
    //           total: 16
    //         }
    //       }
    //     });

    //     const response: TopHoldersDashboardResponse = {
    //       topHolders: topHolders,
    //       bots: whitelist.bots,
    //       bluechipHolders: whitelist.bluechipHolders,
    //       whales: whitelist.whales,
    //       size: whitelist.size
    //     }

    //     await this.redis.set(`${id} topHolders`, JSON.stringify(response));

    //     return response;
    //   }
    // }

    // public async startTargeting(id: string): Promise<number> {
    //   const response = await this.httpService.get(`https://slise-ml.herokuapp.com/recs/?whitelist_id=${id}`).toPromise();
    //   if (response.status === 200) {
    //     this.logger.debug('targeting started');
    //     return 1;
    //   }
    //   return 0;
    // }

    // public async getMutualHoldings(id: string): Promise<MutualHoldingsResponse[]> {
    //   const existMutualHolders = await this.redis.get(`${id} mutualHolders`);
    //   if (existMutualHolders) {
    //     const hm: MutualHoldingsResponse[] = JSON.parse(existMutualHolders);
    //     await Promise.all(hm.map(async (mutual) => {
    //       try {
    //         if (mutual.holdings.stats === null) {
    //           const collectionStats = await this.getCollectionStats(mutual.address);
    //           mutual.holdings.stats = collectionStats;
    //         }
    //         if (mutual.totalHolders) {
    //           const totalHolders = await this.fetchHolders(1, mutual.address, 10000);
    //           if (totalHolders) {
    //             mutual.totalHolders = totalHolders.items.length;
    //           }
    //         }
    //       } catch {

    //       }
    //     }));
    //     await this.redis.set(`${id} mutualHolders`, JSON.stringify(hm));

    //     return hm;
    //   } else {
    //     const whitelist = await this.prisma.waitlist.findFirst({
    //       where: {
    //         id: id
    //       }
    //     });
    //     const mutualHoldings = await this.prisma.$queryRaw<MutualHoldingsResponse[]>`select DISTINCT "TokenTransfer".address, "TokenTransfer".name, count("TokenTransfer".name) as totalHoldings from "TokenTransfer"
    //       where "TokenTransfer"."waitlistId" = ${id}  and "TokenTransfer".address <> ${whitelist.contractAddress?.toLowerCase() ?? ''} and lower("TokenTransfer".address) <> '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85'
    //       and "contractType" = 'ERC721'
    //       group by "TokenTransfer".name, "TokenTransfer".address
    //       order by totalHoldings desc
    //       limit 10;`;

    //     let failed: string[] = [];

    //     await Promise.all(mutualHoldings.map(async (holding) => {
    //       try {
    //         const response = await this.getCollectionInfo(holding.address);
    //         if (response) {
    //           holding.holdings = response;
    //         }
    //         const totalHolders = await this.fetchHolders(1, holding.address, 10000);
    //         if (totalHolders) {
    //           holding.totalHolders = totalHolders.items.length;
    //         }
    //         const collectionStats = await this.getCollectionStats(holding.address);
    //         holding.holdings.stats = collectionStats;
    //       } catch (e) {
    //         failed.push(holding.address);
    //       }
    //     }
    //     ));

    //     mutualHoldings.sort((a, b) => {
    //       return b.totalholdings - a.totalholdings;
    //     });

    //     this.logger.debug('NFT port requests');
    //     let initPercent = 100;
    //     let initValue: number;
    //     mutualHoldings.map((holding, idx) => {
    //       if (idx === 0) {
    //         initValue = holding.totalholdings;
    //         holding.percent = initPercent;
    //       } else {
    //         holding.percent = ((holding.totalholdings / initValue) * initPercent);
    //       }
    //     });

    //     await this.redis.set(`${id} mutualHolders`, JSON.stringify(mutualHoldings));

    //     return mutualHoldings;
    //   }

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

  public async tokenHoldersFromSource(network: number, token: string, pageSize: number): Promise<TokenHolderInternal[]> {
    const holders = await this.fetchTokenHolders(network, token, pageSize);

    return holders;
  }

  public async eventsByContractsAndAddresses(contractAddresses: string[], addresses: string[]): Promise<BlockChainUserEvent[]> {
    this.logger.debug(`search for events by addresses ${addresses}`);
    return await this.fetchEventsByContractsAndAddresses(contractAddresses, addresses);
  }

  // public async parseHolders(request: WhitelistInfoRequest): Promise<string> {
  //   this.logger.debug(`collection: ${request.collectionName} received for processing`);
  //   const hldrs = await this.fetchHolders(1, '', 10000);
  //   const addresses = hldrs.items.map((item) => {
  //     return item.address;
  //   });
  //   const waitlist = await this.prisma.waitlist.create({
  //     data: {
  //       name: request.collectionName,
  //     }
  //   });
  //   const holdersRequest = {
  //     addresses: addresses,
  //     waitlistId: waitlist.id
  //   };
  //   const job = await this.holdersQueue.add('parseAndStore', {
  //     holdersRequest
  //   });
  //   this.logger.debug(`collection: ${request.collectionName} will be processed with jobId: ${job.id}`);
  //   return waitlist.id;
  // }

  public async storeWhitelist(waitlistRequest: WhitelistInfoRequest, file: Express.Multer.File): Promise<WhitelistInfoResponse> {
    this.logger.debug(`collection: ${waitlistRequest.collectionName} received for processing`);
    let s3File;
    try {
      const uploadedFile = await this.storage.upload(file);
      s3File = await this.storage.getFile(uploadedFile.key);
    } catch (e) {
      this.logger.debug(`error uploading file ${e.toString()}`)
    }
    if (!s3File.Body) {
      throw new BadRequestException(`No data in file`);
    }
    /*const waitlist = await this.prisma.waitlist.create({
      data: {
        name: waitlistRequest.collectionName,
        mainWaitlist: false
      }
    });*/

    /* const holdersRequest = {
       id: waitlist.id,
       file: s3File,
       waitlistId: waitlist.id
     };*/
    const data = Buffer.from(s3File.Body).toString('utf8');
    const parsedCsv = await papaparse.parse(data, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => results.data
    });
    //TODO: change to map in map
    let addresses: string[] = [];
    parsedCsv.data.map((subarray) => subarray.map((address) => {
      addresses.push(address);
    }));

    await this.processWhitelist(addresses);
    /* const job = await this.holdersQueue.add('parseAndStore', {
       holdersRequest
     });*/
    //this.logger.debug(`collection: ${holdersRequest.waitlistId} will be processed with jobId: ${job.id}`);
    return {
      name: waitlistRequest.collectionName,
      id: ''//waitlist.id
    };
  }

  public async storeClearWhitelist(whitelistRequest: WhitelistInfoRequest): Promise<WhitelistInfoResponse> {
    this.logger.debug(`collection: ${whitelistRequest.collectionName} received for processing`);
    const whitelist = await this.prisma.whitelist.create({
      data: {
        name: whitelistRequest.collectionName,
        size: 0,
      }
    })
    return {
      name: whitelist.name,
      id: whitelist.id
    };
  }

  private async processWhitelist(addresses: string[]): Promise<any> {
    const whitelistHolders = await Promise.all(addresses.map(async (address) => {
      const holderAddress = address.toLowerCase();

      const tokenBalance = await this.blockchainService.getNFTs(holderAddress);
      const accountBalance = await this.blockchainService.getAccountBalance(holderAddress);
      const totalNFTs = tokenBalance.reduce((accumulator, item) => accumulator + item.balance, 0);
      return {
        address: holderAddress,
        tokenBalance: tokenBalance,
        accountBalance: accountBalance,
        totalNFTs: totalNFTs
      }

    }));

    const topHolders = whitelistHolders.sort((a, b) => (a.accountBalance.usdBalance > b.accountBalance.usdBalance) ? 1 : -1);
    let allHoldings: TokenBalance[] = [];
    whitelistHolders.map(holder => {
      allHoldings.push(...holder.tokenBalance);
    });
    const countUniqueHoldings = (arr: TokenBalance[]) => {
      const counts = {};
      for (var i = 0; i < arr.length; i++) {
        counts[arr[i].contractAddress] = 1 + (counts[arr[i].contractAddress] || 0);
      };
      return counts;
    };

    const uniqueHoldings = countUniqueHoldings(allHoldings);
    const a = uniqueHoldings;
  }

  public async tokenEventsByContract(network: number, token: string, pageSize: number): Promise<BlockChainUserEvent[]> {
    let holders: TokenHolderInternal[] = [];
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
      floor: data.statistics.floor_price || 1.16,
      supply: data.statistics.total_supply || 10000,
      mintPrice: data.statistics.floor_price / 5.2 || 0.83
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
}