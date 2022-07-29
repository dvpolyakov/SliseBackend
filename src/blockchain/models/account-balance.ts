export class AccountBalanceResponse {
  ethBalance?: number;
  usdBalance?: number;
}

export class NftDto {
  name: string;
  collectionTokenId: number
  collectionName: string
  imageUrl?: string
  collectionAddress: string
  description: string
}