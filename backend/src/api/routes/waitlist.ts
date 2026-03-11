import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /api/v1/waitlist — join the waitlist
router.post('/', async (req, res, next) => {
  try {
    const { email, walletAddress } = req.body;

    if (!email || typeof email !== 'string') {
      throw new AppError(400, 'email is required');
    }

    const normalised = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
      throw new AppError(400, 'Invalid email address');
    }

    // Check if already joined
    const existing = await prisma.waitlistEntry.findUnique({ where: { email: normalised } });
    if (existing) {
      return res.json({ success: true, id: existing.id, alreadyJoined: true });
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        email: normalised,
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
