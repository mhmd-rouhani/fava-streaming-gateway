import { Router } from 'express';
import Busboy from 'busboy';
import { randomUUID } from 'crypto';
import path from 'path';
import {
  uploadStream,
  listFiles,
  getObjectStream,
  deleteObject,
  headObject,
} from '../services/storage.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { config } from '../config.js';

const router = Router();

function sanitizeFilename(name) {
  const base = path.basename(name || 'file').replace(/[^\w.\-()\s\u0600-\u06FF]/g, '_');
  return base.slice(0, 200) || 'file';
}

router.post('/upload', uploadLimiter, (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({
      error: 'Expected multipart/form-data with a "file" field',
    });
  }

  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > config.maxUploadBytes) {
    return res.status(413).json({
      error: `File too large. Max allowed is ${config.maxUploadBytes} bytes`,
    });
  }

  let settled = false;
  let fileHandled = false;

  const fail = (status, message) => {
    if (settled) return;
    settled = true;
    if (!res.headersSent) {
      res.status(status).json({ error: message });
    } else {
      res.destroy();
    }
  };

  let busboy;
  try {
    busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fields: 10,
        fileSize: config.maxUploadBytes,
      },
    });
  } catch (err) {
    return fail(400, err.message || 'Invalid multipart request');
  }

  busboy.on('file', (fieldname, fileStream, info) => {
    if (fieldname !== 'file') {
      fileStream.resume();
      return;
    }

    fileHandled = true;
    const originalName = sanitizeFilename(info.filename);
    if (!info.filename || !String(info.filename).trim()) {
      fileStream.resume();
      return fail(400, 'Filename is required');
    }

    const key = `${Date.now()}-${randomUUID().slice(0, 8)}-${originalName}`;
    let truncated = false;

    fileStream.on('limit', () => {
      truncated = true;
      fileStream.destroy(new Error('File exceeds size limit'));
    });

    const onClose = () => {
      fileStream.destroy(new Error('Client aborted upload'));
    };
    req.on('aborted', onClose);
    res.on('close', () => {
      if (!settled) onClose();
    });

    uploadStream(fileStream, {
      key,
      contentType: info.mimeType || 'application/octet-stream',
      originalName,
    })
      .then(async (result) => {
        if (settled) return;
        if (truncated) {
          try {
            await deleteObject(key);
          } catch {}
          return fail(413, `File too large. Max allowed is ${config.maxUploadBytes} bytes`);
        }
        settled = true;
        res.status(201).json({
          message: 'Upload complete',
          file: {
            key: result.key,
            originalName,
            contentType: info.mimeType || 'application/octet-stream',
            etag: result.etag,
          },
        });
      })
      .catch(async (err) => {
        if (truncated || /size limit/i.test(err.message || '')) {
          try {
            await deleteObject(key);
          } catch {}
          return fail(413, `File too large. Max allowed is ${config.maxUploadBytes} bytes`);
        }
        fail(500, err.message || 'Upload failed');
      });
  });

  busboy.on('error', (err) => {
    fail(400, err.message || 'Multipart parse error');
  });

  busboy.on('finish', () => {
    if (!fileHandled && !settled) {
      fail(400, 'No file field found in multipart body');
    }
  });

  req.pipe(busboy);
});

router.get('/', async (_req, res, next) => {
  try {
    const files = await listFiles();
    res.json({ files });
  } catch (err) {
    next(err);
  }
});

router.get('/:key/download', async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const obj = await getObjectStream(key);

    const original =
      (obj.metadata.originalname && decodeURIComponent(obj.metadata.originalname)) ||
      key.split('-').slice(2).join('-') ||
      key;

    res.setHeader('Content-Type', obj.contentType);
    if (obj.contentLength != null) {
      res.setHeader('Content-Length', String(obj.contentLength));
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(original)}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    obj.body.on('error', (err) => {
      if (!res.headersSent) {
        next(err);
      } else {
        res.destroy(err);
      }
    });

    obj.body.pipe(res);
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

router.get('/:key/meta', async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const head = await headObject(key);
    res.json({
      key,
      contentType: head.ContentType,
      contentLength: head.ContentLength,
      lastModified: head.LastModified,
      etag: head.ETag,
      metadata: head.Metadata,
    });
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

router.delete('/:key', async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.params.key);
    await deleteObject(key);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
