// src/routes/webhook.ts
import { Router } from 'express';
import { isValidAlertData, transformAlertData } from '../utils/util';
import { placeOrder } from '../client/bingx/place-order';

const router = Router();

router.post('/', async (req, res): Promise<void> => {
  const alertData = req.body;

  // Validate the webhook data
  if (!isValidAlertData(alertData)) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid webhook data format',
    });
    return; // Stop execution here
  }

  const data = transformAlertData(alertData);
  // Process the valid data
  console.log('📊 Valid Webhook Received:', data);

  const order_response = await placeOrder(data)
  console.log(order_response)

  // Send a success response
  res.status(200).json({
    status: 'success',
    message: 'Webhook received!',
    data: alertData,
  });
});

export default router;