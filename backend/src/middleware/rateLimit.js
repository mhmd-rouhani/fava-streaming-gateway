import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

export const uploadLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.uploadMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload rate limit exceeded. Please try again later.' },
});
