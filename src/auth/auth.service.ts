import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { AuthUserRequest } from './requests/auth-user-request';
import { JwtPayload } from './models/payload';
import { User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenModel } from './models/jwt-model';
import { mapTokenChainType } from '../common/utils/token-mapper';
import { AuthWhitelistMember } from './requests/auth-whitelistmember-request';
import { ETH_QUEUE_KEY_NAME, SOL_QUEUE_KEY_NAME, WHITELISTS_KEY_NAME } from '../common/utils/redis-consts';
import { NetworkType } from '../common/enums/network-type';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { makeRandomWord } from '../common/utils/hashmaker';
import { IntegraionService } from '../integration/integration.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly analyticsService: AnalyticsService,
    @InjectQueue('whitelist') private readonly holdersQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly integrationService: IntegraionService,
  ) {
  }

  public async authUser(request: AuthUserRequest): Promise<JwtTokenModel> {
    try {
      this.logger.debug(`trying to authorize user ${request.address}`);
      const user = await this.userService.findOne(request);
      if (!user) {
        const createdUser = await this.userService.createUser(request);
        const wl = await this.analyticsService.storeClearWhitelist({
            networkType: request.networkType,
            collectionName: `UnnamedWhitelist-${makeRandomWord(3)}`,
          },
          {
            address: request.address,
            networkType: request.networkType
          });
        //return createdUser.address;
        let jwtTokenModel = this._createToken(createdUser);
        jwtTokenModel.whitelistId = wl.id;
        jwtTokenModel.publicLink = wl.publicLink;
        return jwtTokenModel;
      }
      //return user.address;
      let jwtTokenModelExist = this._createToken(user);
      const wl = await this.prisma.whitelist.findFirst({
        where: {
          ownerId: user.address
        },
        include: {
          whitelistLink: true
        }
      });
      jwtTokenModelExist.whitelistId = wl.id;
      jwtTokenModelExist.publicLink = wl.whitelistLink.link;
      return jwtTokenModelExist;
    } catch (e) {
      this.logger.debug(`error authorization user ${request.address}`);
    }
  }

  public async authWhitelistMember(request: AuthWhitelistMember): Promise<string> {
    //const existWhitelist = await this.redis.sismember(WHITELISTS_KEY_NAME, request.whitelistId);
    const existWhitelist = await this.prisma.whitelistLink.findUnique({
      where: {
        link: request.link
      },
      include: {
        whitelist: {
          include: {
            whitelistInfo: true
          }
        }
      }
    });
    if (!existWhitelist)
      throw new BadRequestException(`Whitelist not found`);

    if (existWhitelist.whitelist.whitelistInfo.registrationActive !== true)
      throw new BadRequestException('Registration not active');

    const isRegistered = await this.prisma.whitelistMember.count({
      where: {
        whitelistId: existWhitelist.whitelistId,
        address: request.address
      }
    }) > 0;

    if (isRegistered)
      throw new BadRequestException('Already registered');

    const whitelistMember = await this.prisma.whitelistMember.create({
      data: {
        address: request.address,
        totalTokens: 0,
        whitelistId: existWhitelist.whitelistId,
        tokenProcessedAttemps: 0,
        WhitelistMemberInfo: {
          create: {
            discord: request.discord || null,
            twitter: request.twitter || null,
            twitterFollowers: request.twitter === null ? null : await this.integrationService.getTwitterFollowersCount(request.twitter)
          }
        }
      }
    });
    this.logger.debug(`Saved whitelist member ${whitelistMember.address} in whitelist ${whitelistMember.whitelistId}`);

    let job;

    const jobRequest = {
      whitelistId: existWhitelist.whitelistId,
      address: request.address,
      networkType: request.networkType,
      whitelistMemberId: whitelistMember.id
    }

    switch (request.networkType) {
      case NetworkType.Ethereum:
        job = await this.holdersQueue.add(ETH_QUEUE_KEY_NAME, {
          jobRequest
        });
        break;
      case NetworkType.Polygon:
        job = await this.holdersQueue.add(ETH_QUEUE_KEY_NAME, {
          jobRequest
        });
        break;
      case NetworkType.Solana:
        job = await this.holdersQueue.add(SOL_QUEUE_KEY_NAME, {
          jobRequest
        });
        break;
      case NetworkType.Unknown:
        this.logger.debug(`unknown whitelist member ${request.address}`);
        break;
      default:
        job = await this.holdersQueue.add(ETH_QUEUE_KEY_NAME, {
          jobRequest
        });
        break;
    }

    this.logger.debug(`whitelist member: ${request.address} will be processed with jobId: ${job.id}`);
    return request.address;
  }

  public async validateUser(payload: JwtPayload): Promise<User> {
    const user = await this.userService.findOne(payload);
    if (!user) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    return user;
  }

  private _createToken(userModel: User): JwtTokenModel {
    const exp = new Date();
    exp.setDate(exp.getDate() + +process.env.EXPIRESIN);
    const expiresIn = exp;

    const user: JwtPayload = {
      address: userModel.address,
      networkType: mapTokenChainType(userModel.chainType)
    };
    const accessToken = this.jwtService.sign(user);
    return {
      expiresIn,
      accessToken,
      chainType: userModel.chainType
    };
  }
}