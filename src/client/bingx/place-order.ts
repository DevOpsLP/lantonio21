import { BingXClient } from ".";
import { AlertData } from "../../types";
import * as dotenv from "dotenv";
dotenv.config();

const client = new BingXClient({
  apiKey: process.env.BINGX_API_KEY,
  apiSecret: process.env.BINGX_API_SECRET
});

export async function placeOrder(alert: AlertData): Promise<any> {
  // 1) Calculate total order size as size / entry.
  const totalOrderSize = parseFloat(alert.size) / parseFloat(alert.entry);

  // 2) Map alert side to BUY/SELL.
  const side = alert.side === "LONG" ? "BUY" : "SELL";

  // 3) Process the tps array.
  // Each element in alert.tps is expected to be { price: string, investment: string }.
  // We'll sum the investment percentages until reaching 100%.
  interface ProcessedTP {
    type: string;
    stopPrice: number;
    price: number;
    workingType: string;
    quantity?: number;
  }
  
  let processedTPs: ProcessedTP[] = [];
  let cumulativeInvestment = 0;
  
  if (alert.tps && alert.tps.length > 0) {
    // Check if the first TP's investment is exactly "100%"
    const firstInvestment = parseFloat(alert.tps[0].investment.replace("%", ""));
    if (firstInvestment === 100) {
      // Use only the first TP with full allocation.
      const tpPrice = parseFloat(alert.tps[0].price);
      processedTPs.push({
        type: "TAKE_PROFIT_MARKET",
        stopPrice: tpPrice,
        price: tpPrice,
        workingType: "MARK_PRICE",
      });
    } else {
      // Iterate through tps until cumulative investment reaches 100%.
      for (let i = 0; i < alert.tps.length; i++) {
        let currentInvestment = parseFloat(alert.tps[i].investment.replace("%", ""));
        if (cumulativeInvestment >= 100) break;
        if (cumulativeInvestment + currentInvestment > 100) {
          currentInvestment = 100 - cumulativeInvestment;
        }
        cumulativeInvestment += currentInvestment;
        const tpPrice = parseFloat(alert.tps[i].price);
        // Initially assign all as TAKE_PROFIT; later, update the last one.
        processedTPs.push({
          type: "TAKE_PROFIT",
          stopPrice: tpPrice,
          price: tpPrice,
          workingType: "MARK_PRICE",
          quantity: totalOrderSize * (currentInvestment / 100)
        });
      }
      // Update the last TP to be the main one with type TAKE_PROFIT_MARKET.
      if (processedTPs.length > 0) {
        processedTPs[processedTPs.length - 1].type = "TAKE_PROFIT_MARKET";
      }
    }
  }

  // 4) The main order payload should include only the last TP as its takeProfit order.
  const mainTakeProfit = processedTPs.length > 0 ? processedTPs[processedTPs.length - 1] : undefined;

  // Build the stopLoss order.
  const parsedStopPrice = parseFloat(alert.stop);
  const stopLossOrder = {
    type: "STOP_MARKET",
    stopPrice: parsedStopPrice,
    price: parsedStopPrice,
    workingType: "MARK_PRICE"
  };

  // 5) Build the main order payload.
  // Note: takeProfit is now an object (not an array) that represents the main TP.
  const payload: any = {
    symbol: alert.symbol,
    type: "MARKET",
    side: side,
    positionSide: alert.side,
    quantity: totalOrderSize,
    takeProfit: mainTakeProfit ? JSON.stringify(mainTakeProfit) : undefined,
    stopLoss: JSON.stringify(stopLossOrder),
    recvWindow: 5000,
    timestamp: Date.now()
  };

  console.log("Main order payload:", payload);

  // 6) Place the main order.
  const testOrderResponse = await client.post(
    "/openApi/swap/v2/trade/order",
    payload,
    true
  );

  // 7) For any remaining TPs (if there are more than one), send them as separate new LIMIT orders.
  const remainingTPs = processedTPs.length > 1 ? processedTPs.slice(0, processedTPs.length - 1) : [];
  if (remainingTPs.length > 0) {
    // Example: iterate through each remaining TP and place a LIMIT order.
    for (const tpOrder of remainingTPs) {
      const limitOrderPayload = {
        symbol: alert.symbol,
        type: "LIMIT",
        side: side,
        positionSide: alert.side,
        quantity: tpOrder.quantity,
        price: tpOrder.price,
        recvWindow: 5000,
        timestamp: Date.now()
      };
      console.log("Placing separate LIMIT order for TP:", limitOrderPayload);

      // Uncomment the following line to send the order:
      await client.post("/openApi/swap/v2/trade/order", limitOrderPayload, true);
    }
  }

  return testOrderResponse;
}