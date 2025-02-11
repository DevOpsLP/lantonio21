export interface AlertData {
  symbol: string;
  side: "LONG" | "SHORT";
  entry: string;
  winrate: string;
  strategy: string;
  beTargetTrigger: "1" | "2" | "3" | "WITHOUT";
  stop: string;
  size: string;
  tps: {
    price: string;
    investment: string;
  }[];
}