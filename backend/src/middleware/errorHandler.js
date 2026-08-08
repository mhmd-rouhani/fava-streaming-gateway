export function errorHandler(err, _req, res, _next) {
  console.error('[error]', err);

  if (res.headersSent) {
    return;
  }

  const status = err.status || err.statusCode || 500;
  const payload = {
    error:
      status >= 500
        ? 'Internal Server Error'
        : err.message || 'Request failed',
  };

  // In non-production, include a bit more detail for debugging.
  if (process.env.NODE_ENV !== 'production' && status >= 500 && err.message) {
    payload.detail = err.message;
  }

  res.status(status).json(payload);
}
