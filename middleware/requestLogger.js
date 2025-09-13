function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const SENSITIVE = new Set(['password', 'newPassword', 'otp', 'token']);
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE.has(k)) {
      out[k] = '***REDACTED***';
    } else if (v && typeof v === 'object') {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const safeBody = redact(req.body || {});
    const safeQuery = redact(req.query || {});
    const userId = req.user ? req.user._id : undefined;
    // Keep log compact
    console.log(
      `[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${durationMs.toFixed(1)}ms` +
      (userId ? ` user=${userId}` : '') +
      ` ip=${req.ip} q=${JSON.stringify(safeQuery)} b=${JSON.stringify(safeBody)}`
    );
  });
  next();
};
