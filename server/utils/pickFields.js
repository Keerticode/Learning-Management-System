export const pickFields = (source, allowed) => {
  if (!source || typeof source !== 'object') return {};
  const picked = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      picked[key] = source[key];
    }
  }
  return picked;
};

export default pickFields;