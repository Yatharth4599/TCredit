import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { validate } from '../middleware/validate.js';
import { WaitlistJoinSchema } from '../schemas.js';

const router = Router();

// POST /api/v1/waitlist — join the waitlist
router.post('/', validate(WaitlistJoinSchema), async (req, res, next) => {
  try {
    const { email, walletAddress } = req.body;

    // email is already validated + normalized by Zod schema (trimmed, lowercased)

    // Check if already joined
    const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
    if (existing) {
      return res.json({ success: true, id: existing.id, alreadyJoined: true });
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        email,
        walletAddress: walletAddress?.trim() || null,
      },
    });

    return res.status(201).json({ success: true, id: entry.id, alreadyJoined: false });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/waitlist/count — public entry count
router.get('/count', async (_req, res, next) => {
  try {
    const count = await prisma.waitlistEntry.count();
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

export default router;
