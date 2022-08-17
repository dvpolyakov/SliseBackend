export class AccountBalanceResponse {
  tokenBalance?: number;

  usdBalance?: number;
}

export class NftDto {
  name: string;

  collectionTokenId: number;

  collectionName: string;

  imageUrl?: string;

  collectionAddress: string;

  description: string;
}
