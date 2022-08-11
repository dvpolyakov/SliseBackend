import { NetworkType } from '../../common/enums/network-type';

export class WhitelistResponse {
  id: string;
  name: string;
  networkType: NetworkType;
  logo: string;
}