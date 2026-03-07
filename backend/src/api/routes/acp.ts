import { Router } from 'express';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /api/v1/acp/checkout/create — create checkout session (Stripe stub)
router.post('/checkout/create', async (req, res, next) => {
  try {
    const { merchantAddress, amount, currency, description } = req.body;
    if (!merchantAddress || !amount) {
      throw new AppError(400, 'merchantAddress and amount required');
    }

    // Stub: In production, this creates a Stripe Checkout Session
    // and stores the checkout in DB for webhook completion
    const checkoutId = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    res.json({
      checkoutId,
      status: 'pending',
      merchantAddress,
      amount: String(amount),
      currency: currency ?? 'usd',
      description: description ?? '',
      // In production: url: stripeSession.url
      message: 'Stripe checkout integration ready — configure STRIPE_SECRET_KEY to enable',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/acp/checkout/complete — complete checkout (webhook callback)
router.post('/checkout/complete', async (req, res, next) => {
  try {
    const { checkoutId } = req.body;
    if (!checkoutId) throw new AppError(400, 'checkoutId required');

    // Stub: In production, verify Stripe webhook, then route through PaymentRouter
    res.json({
      checkoutId,
      status: 'completed',
      message: 'Checkout completion will route payment through Krexa Revenue Router',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
