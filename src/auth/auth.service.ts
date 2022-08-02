import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { AuthUserRequest } from '../user/requests/auth-user-request';
import { JwtPayload } from './models/payload';
import { User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenModel } from './models/jwt-model';
import { mapTokenChainType } from '../utils/token-mapper';


@Injectable()
export class AuthService{
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    ) {
  }

  public async authUser(request: AuthUserRequest): Promise<string> {
    const user = await this.userService.findOne(request);
    if(!user){
      const createdUser = await this.userService.createUser(request);
      return createdUser.address;
      //return this._createToken(createdUser);
    }
    return user.address;
    //return this._createToken(user);
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
    };
  }
}