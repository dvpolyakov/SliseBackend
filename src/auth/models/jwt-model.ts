export class JwtTokenModel {
  accessToken: string;
  expiresIn: Date;
  chainType: string;
  publicLink?: string;
  whitelistId?: string;
}