// index.ts
import express from 'express';
import dotenv from 'dotenv';
import webhookRouter from './routes/webhook';
import { checkAccountBalance } from './client/bingx/health-check';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/webhook', webhookRouter);

// Check account balance before starting the server
checkAccountBalance()
  .then((isValid) => {
    if (isValid) {
      app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
      });
    }
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1); // Stop the server if the balance check fails
  });