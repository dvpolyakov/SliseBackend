import { TokenType } from '@prisma/client';

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