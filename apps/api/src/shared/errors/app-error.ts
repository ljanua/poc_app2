export type AppErrorCode =
  | 'validation_error'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'unknown';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: AppErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function appValidationError(message = 'Please review the form fields and try again.'): AppError {
  return new AppError(400, 'validation_error', message);
}

export function appForbiddenError(
  message = 'You do not have permission to perform this action.'
): AppError {
  return new AppError(403, 'forbidden', message);
}

export function appNotFoundError(
  message = 'The selected user was not found anymore. Refresh and try again.'
): AppError {
  return new AppError(404, 'not_found', message);
}

export function appConflictError(
  message = 'A user with the same identifier already exists.'
): AppError {
  return new AppError(409, 'conflict', message);
}
