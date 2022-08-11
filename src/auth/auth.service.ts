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


@Injectable()
export class AuthService{
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @InjectQueue('whitelist') private readonly holdersQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService
    ) {
  }

  public async authUser(request: AuthUserRequest): Promise<JwtTokenModel> {
    const user = await this.userService.findOne(request);
    if(!user){
      const createdUser = await this.userService.createUser(request);
      //return createdUser.address;
      return this._createToken(createdUser);
    }
    //return user.address;
    return this._createToken(user);
  }

  public async authWhitelistMember(request: AuthWhitelistMember): Promise<string> {
    //const existWhitelist = await this.redis.sismember(WHITELISTS_KEY_NAME, request.whitelistId);
    const existWhitelist = await this.prisma.whitelistLink.findUnique({
      where:{
        link: request.link
      },
      include: {
        whitelist: {
          include: {
            settings: true
          }
        }
      }
    });
    if(!existWhitelist)
      throw new BadRequestException(`Whitelist not found`);

    if(existWhitelist.whitelist.settings.registrationActive !== true)
      throw new BadRequestException('Registration not active');

    const isRegistered = await this.prisma.whitelistMember.count({
      where: {
        whitelistId: existWhitelist.whitelistId,
        address: request.address
      }
    }) > 0;

    if(isRegistered)
      throw new BadRequestException('Already registered');

    const whitelistMember = await this.prisma.whitelistMember.create({
      data: {
        address: request.address,
        totalTokens: 0,
        whitelistId: existWhitelist.whitelistId,
        tokenProcessedAttemps: 0,
        WhitelistMemberInfo: {
          create: {
            discord: null,
            twitter: null,
            twitterFollowers: null
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

    switch (request.networkType){
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