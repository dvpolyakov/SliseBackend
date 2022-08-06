import { CollectionInfoResponse } from './whitelist-statistics-response';

export interface TokenBalance {
  contractName: string
  contractSymbol: string
  contractAddress: string
  tokenType: string
  nftVersion?: string
  nftDescription: string
  balance: number
  nfts: TokenData[]
  collectionInfo?: CollectionInfoResponse
}

export interface TokenData {
  tokenId: number
  name: string
  amount: number
  image: string
}
