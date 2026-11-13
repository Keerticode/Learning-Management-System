const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

export const escapeRegex = (input) => {
  if (typeof input !== 'string' || input.length === 0) return '';
  return input.replace(REGEX_SPECIAL_CHARS, '\\$&');
};

export default escapeRegex;
