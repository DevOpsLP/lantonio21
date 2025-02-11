// checkBalance.ts
import { time } from "console";
import { BingXClient } from ".";
import * as dotenv from "dotenv";
dotenv.config();

const client = new BingXClient({
  apiKey: process.env.BINGX_API_KEY,
  apiSecret: process.env.BINGX_API_SECRET
});

export async function checkAccountBalance(): Promise<boolean> {
  try {
    // 1. Check your balance first
    const balanceResponse = await client.get("/openApi/swap/v3/user/balance", {}, true);
    const balances = balanceResponse.data;
    console.log(balanceResponse)
    if (Array.isArray(balances)) {
      const usdtAccount = balances.find((account: any) => account.asset === "USDT");
      if (usdtAccount && parseFloat(usdtAccount.balance) > 0) {
        const payload = {
            symbol: "BTC-USDT",
            type: "MARKET",
            side: "BUY",
            positionSide: "LONG",
            quantity: 5,
            takeProfit: JSON.stringify({
              type: "TAKE_PROFIT_MARKET",
              stopPrice: 31968,
              price: 31968,
              workingType: "MARK_PRICE"
            }),
            stopLoss: JSON.stringify({
                type: "STOP_MARKET",
                stopPrice: 30000,
                price: 30000,
                workingType: "MARK_PRICE"
              }),
            recvWindow: 5000, // Add this
            timestamp: Date.now() // Ensure fresh timestamp
          };

        // 3. Call the test endpoint with a POST request
        const testOrderResponse = await client.post(
          "/openApi/swap/v2/trade/order/test",
          payload,
          true // 'isPrivate' must be true for signed requests
        );
        
        // 4. Check if the API indicated success
        if (testOrderResponse.success) {
          console.log("Order test successful!", testOrderResponse.data);

        } else {
          console.error("Order test failed:", testOrderResponse);

        }

        return true;

      }
    }

    // If no positive USDT balance, throw an error
    throw new Error(
      "Something failed, check your credentials or make sure your account has enough funds to trade"
    );
  } catch (error) {
    throw new Error(
      "Something failed, check your credentials or make sure your account has enough funds to trade"
    );
  }
}