import { NetworkType } from '../../common/enums/network-type';
import { IsBoolean, IsDate, IsNumber } from 'class-validator';

export class ProjectInfoRequest {
  @IsBoolean()
  registrationActive: boolean;
  @IsDate()
  mintDate: Date;
  collectionName: string;
  twitter: string;
  discord: string;
  @IsNumber({allowNaN: true})
  mintPrice: number;
  @IsNumber({allowNaN: true})
  totalSupply: number;
  description: string;
  blockchain: NetworkType;
}

export class ProjectInfoResponse {
  registrationActive: boolean;
  mintDate: Date;
  collectionName: string;
  twitter: string;
  discord: string;
  mintPrice: number;
  totalSupply: number;
  description: string;
  logo: string;
  blockchain: NetworkType;
  link: string;
}