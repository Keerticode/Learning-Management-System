
import slugifyLib from 'slugify';

const DEFAULT_OPTIONS = Object.freeze({
  lower: true,
  strict: true,
  trim: true,
  locale: 'en',
  replacement: '-',
});

export function slugify(input, overrides = {}) {
  if (typeof input !== 'string' || input.trim().length === 0) return '';
  return slugifyLib(input, { ...DEFAULT_OPTIONS, ...overrides });
}

export default slugify;
