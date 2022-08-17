import { ChainType, TokenType } from '@prisma/client';
import { NetworkType } from '../enums/network-type';

export function mapTokenType(tokenType: string): TokenType {
  let tknType: TokenType;
  switch (tokenType) {
    case 'ERC20':
      tknType = TokenType.ERC20;
      break;
    case 'ERC223':
      tknType = TokenType.ERC223;
      break;
    case 'ERC721':
      tknType = TokenType.ERC721;
      break;
    case 'ERC827':
      tknType = TokenType.ERC827;
      break;
    case 'ERC1155':
      tknType = TokenType.ERC1155;
      break;
    case '-':
      tknType = TokenType.UNKOWN;
      break;
    case '':
      tknType = TokenType.UNKOWN;
      break;
    default:
      tknType = TokenType.UNKOWN;
      break;
  }
  return tknType;
}

export function mapChainType(networkType: NetworkType): ChainType {
  let chainType: ChainType;
  switch (networkType) {
    case NetworkType.Unknown:
      chainType = ChainType.UNKNOWN;
      break;
    case NetworkType.Ethereum:
      chainType = ChainType.ETHEREUM;
      break;
    case NetworkType.Polygon:
      chainType = ChainType.POLYGON;
      break;
    case NetworkType.Solana:
      chainType = ChainType.SOLANA;
      break;
    default:
      chainType = ChainType.UNKNOWN;
      break;
  }
  return chainType;
}

export function mapTokenChainType(chainType: ChainType): NetworkType {
  let networkType: NetworkType;
  switch (chainType) {
    case ChainType.UNKNOWN:
      networkType = NetworkType.Unknown;
      break;
    case ChainType.ETHEREUM:
      networkType = NetworkType.Ethereum;
      break;
    case ChainType.POLYGON:
      networkType = NetworkType.Polygon;
      break;
    case ChainType.SOLANA:
      networkType = NetworkType.Solana;
      break;
    default:
      networkType = NetworkType.Unknown;
      break;
  }
  return networkType;
}
