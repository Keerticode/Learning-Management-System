import { ApiError } from '../utils/ApiError.js';

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action.'));
    }
    return next();
  };

export const adminOnly = requireRole('admin');
export const instructorOrAdmin = requireRole('instructor', 'admin');
export const studentOnly = requireRole('student');

export default requireRole;
