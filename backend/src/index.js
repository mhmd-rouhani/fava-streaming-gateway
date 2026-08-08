import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { ensureBucket } from './services/storage.js';
import filesRouter from './routes/files.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';

const app = express();

// Behind Nginx — needed so rate-limit sees the real client IP.
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health is intentionally not rate-limited (compose / probes).
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'fava-backend' });
});

// No express.json() / urlencoded on the upload path — bodies stream via Busboy.
app.use('/files', apiLimiter, filesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

async function start() {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await ensureBucket();
      console.log(`S3 bucket ready: ${config.s3.bucket}`);
      break;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error('Failed to reach object storage after retries:', err);
        process.exit(1);
      }
      console.warn(
        `Waiting for MinIO (attempt ${attempt}/${maxAttempts}): ${err.message}`,
      );
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Backend listening on :${config.port}`);
    console.log(
      `Streaming uploads → ${config.s3.endpoint} / ${config.s3.bucket}`,
    );
    console.log(
      `Rate limits: ${config.rateLimit.uploadMax} uploads / ${config.rateLimit.apiMax} API per ${config.rateLimit.windowMs / 60000}m`,
    );
  });
}

start();
