import { generateAccessToken, verifyAccessToken } from './tokens.js';

export const signAccessToken = (user) => generateAccessToken(user);
export { verifyAccessToken };

export const generateToken = (user) => generateAccessToken(user);

export default generateToken;