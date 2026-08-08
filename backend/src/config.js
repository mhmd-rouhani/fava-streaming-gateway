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
  /** Multipart part size for @aws-sdk/lib-storage (keeps memory bounded). */
  uploadPartSize: 5 * 1024 * 1024,
  /** Only one part in flight at a time to stay well under the 150MB limit. */
  uploadQueueSize: 1,
  /** Reject uploads larger than this (default 5 GiB). */
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024 * 1024),
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    apiMax: Number(process.env.RATE_LIMIT_API_MAX || 120),
    uploadMax: Number(process.env.RATE_LIMIT_UPLOAD_MAX || 30),
  },
};
