import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /waitlist — join the waitlist
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, walletAddress } = req.body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const entry = await prisma.waitlistEntry.upsert({
      where: { email: normalizedEmail },
      update: {
        walletAddress: walletAddress || undefined,
      },
      create: {
        email: normalizedEmail,
        walletAddress: walletAddress || null,
      },
    });

    return res.json({ success: true, id: entry.id });
  } catch (err) {
    console.error('[Waitlist] Error:', err);
    return res.status(500).json({ error: 'Failed to join waitlist' });
  }
});

// GET /waitlist/count — total signups
router.get('/count', async (_req: Request, res: Response) => {
  try {
    const count = await prisma.waitlistEntry.count();
    return res.json({ count });
  } catch (err) {
    console.error('[Waitlist] Count error:', err);
    return res.status(500).json({ error: 'Failed to get count' });
  }
});

export default router;
