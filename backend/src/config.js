export const config = {
  port: Number(process.env.BACKEND_PORT || 4000),
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'uploads',
    forcePathStyle: true,
  },
  uploadPartSize: 5 * 1024 * 1024,
  uploadQueueSize: 1,
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024 * 1024),
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    apiMax: Number(process.env.RATE_LIMIT_API_MAX || 120),
    uploadMax: Number(process.env.RATE_LIMIT_UPLOAD_MAX || 30),
  },
};
