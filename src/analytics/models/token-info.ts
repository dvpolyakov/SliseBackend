
export interface TokenBalance {
  contractName: string
  contractSymbol: string
  contractAddress: string
  tokenType: string
  nftVersion?: string
  nftDescription: string
  balance: number
  nfts: TokenData[]
}

export interface TokenData {
  tokenId: string
  name: string
  amount: number
  image: string
}
