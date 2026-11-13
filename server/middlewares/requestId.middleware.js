import { nanoid } from 'nanoid';

const HEADER_NAME = 'X-Request-Id';
const MAX_HEADER_LENGTH = 64;
const SAFE_HEADER_PATTERN = /^[\w.-]+$/;

const sanitizeIncoming = (raw) => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_HEADER_LENGTH) return null;
  return SAFE_HEADER_PATTERN.test(trimmed) ? trimmed : null;
};

export const requestId = (req, res, next) => {
  const incoming = sanitizeIncoming(req.headers['x-request-id']);
  req.id = incoming ?? nanoid(10);
  res.setHeader(HEADER_NAME, req.id);
  next();
};

export default requestId;
