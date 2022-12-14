import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUserRequest } from '../auth/requests/auth-user-request';
import { mapChainType } from '../common/utils/token-mapper';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  public async findOne(request: AuthUserRequest): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        address: request.address,
        chainType: mapChainType(request.networkType),
      },
    });
    return user;
  }

  public async createUser(request: AuthUserRequest): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        address: request.address,
        chainType: mapChainType(request.networkType),
      },
    });
    return user;
  }
}
