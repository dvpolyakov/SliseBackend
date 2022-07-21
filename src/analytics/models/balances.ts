export interface BalanceResponse {
  address: string;
  updated_at: Date;
  next_update_at: Date;
  quote_currency: string;
  chain_id: number;
  items: BalanceItem[];
  pagination: null;
}

export interface BalanceItem {
  contract_decimals: number;
  contract_name: string;
  contract_ticker_symbol: string;
  contract_address: string;
  supports_erc: null;
  logo_url: string;
  last_transferred_at: null;
  type: string;
  balance: string;
  balance_24h: string;
  quote_rate: number;
  quote_rate_24h: number;
  quote: number;
  quote_24h: number;
  nft_data: null;
}
