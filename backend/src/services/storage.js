import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { config } from '../config.js';

const s3 = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: config.s3.forcePathStyle,
});

const bucket = config.s3.bucket;

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err.name === 'NotFound' || err.Code === 'NoSuchBucket') {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      return;
    }
    throw err;
  }
}

export async function uploadStream(body, meta) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: meta.key,
      Body: body,
      ContentType: meta.contentType || 'application/octet-stream',
      ...(meta.contentLength != null
        ? { ContentLength: meta.contentLength }
        : {}),
      Metadata: {
        originalname: encodeURIComponent(meta.originalName || meta.key),
      },
    },
    queueSize: config.uploadQueueSize,
    partSize: config.uploadPartSize,
    leavePartsOnError: false,
  });

  const result = await upload.done();
  return {
    key: meta.key,
    etag: result.ETag,
    bucket,
  };
}

export async function listFiles() {
  const objects = [];
  let ContinuationToken;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken,
      }),
    );

    for (const obj of res.Contents || []) {
      objects.push({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag,
      });
    }

    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);

  objects.sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  );

  return objects;
}

export async function getObjectStream(key) {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  return {
    body: res.Body,
    contentType: res.ContentType || 'application/octet-stream',
    contentLength: res.ContentLength,
    metadata: res.Metadata || {},
  };
}

export async function headObject(key) {
  return s3.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

export async function deleteObject(key) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

export { s3, bucket };
