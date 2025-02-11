import { AlertData } from "../types";

export function isValidAlertData(data: any): data is AlertData {
  return (
    typeof data.symbol === 'string' &&
    typeof data.side === 'string' && (data.side === 'LONG' || data.side === 'SHORT') &&
    typeof data.entry === 'string' &&
    typeof data.winrate === 'string' &&
    typeof data.strategy === 'string' &&
    (
      data.beTargetTrigger === '1' ||
      data.beTargetTrigger === '2' ||
      data.beTargetTrigger === '3' ||
      data.beTargetTrigger === 'WITHOUT'
    ) &&
    typeof data.stop === 'string' &&
    typeof data.size === 'string' &&
    Array.isArray(data.tps) &&
    data.tps.every((tp: any) =>
      tp &&
      typeof tp === 'object' &&
      typeof tp.price === 'string' &&
      typeof tp.investment === 'string'
    )
  );
}

export function parseSymbol(symbol: string): string {
    // Remove ".P" suffix if present (case-insensitive)
    const cleanSymbol = symbol.replace(/\.P$/i, '');
  
    // Split into base and quote (e.g., BTCUSDT → BTC-USDT)
    const match = cleanSymbol.match(/^([A-Z]+)(USDT|BUSD|USD|USDC|BTC|ETH)$/i);
    
    if (match) {
      const [, base, quote] = match;
      return `${base.toUpperCase()}-${quote.toUpperCase()}`;
    }
  
    // Fallback: Attempt to split into 3/4 character quote
    const symbolParts = cleanSymbol.match(/^([A-Z]{3,4})(USDT|USD|BUSD|ETH|BTC)$/i) || 
                        cleanSymbol.match(/^([A-Z]+)([A-Z]{3,4})$/i);
  
    if (symbolParts) {
      return `${symbolParts[1].toUpperCase()}-${symbolParts[2].toUpperCase()}`;
    }
  
    // Return original symbol if no patterns match
    return cleanSymbol.toUpperCase();
  }


export function transformAlertData(data: any): AlertData{
  if (!isValidAlertData(data)) return data;
  return {
    ...data,
    symbol: parseSymbol(data.symbol)
  };
}