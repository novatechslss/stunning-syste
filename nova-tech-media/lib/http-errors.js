export class HttpError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function sendError(res, err) {
  if (err instanceof HttpError) {
    return sendJson(res, err.status, { success: false, error: { code: err.code, message: err.message } }, err.headers);
  }
  // Log only the error class: never messages/stacks, which could contain request data.
  console.error('[nova] unexpected error:', err && err.name);
  return sendJson(res, 500, {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' }
  });
}

/** Restrictive CORS: only origins listed in MEDIA_ALLOWED_ORIGINS. Same-origin needs no CORS. Returns true when a preflight was answered. */
export function applyCors(req, res, cfg) {
  const origin = req.headers.origin;
  if (origin && cfg.allowedOrigins.includes(String(origin).toLowerCase())) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Nova-Client');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function requireMethod(req, allowed) {
  if (!allowed.includes(req.method)) {
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'This method is not allowed on this endpoint.', {
      Allow: allowed.join(', ')
    });
  }
}

export function rateHeaders(rl) {
  return {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rl.resetMs / 1000))
  };
}

export function enforceRate(rl, message) {
  if (!rl.allowed) {
    const retry = Math.max(1, Math.ceil(rl.resetMs / 1000));
    throw new HttpError(429, 'RATE_LIMITED', message || 'Too many requests. Please wait and try again.', {
      'Retry-After': String(retry),
      ...rateHeaders(rl)
    });
  }
}
