export type ApiErrorCode =
  | 'validation_error'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'unknown';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function mapApiErrorToMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'forbidden' || error.status === 403) {
      return 'You do not have permission to perform this action.';
    }

    if (error.code === 'conflict' || error.status === 409) {
      return 'A user with the same identifier already exists.';
    }

    if (error.code === 'validation_error' || error.status === 400) {
      return 'Please review the form fields and try again.';
    }

    if (error.code === 'not_found' || error.status === 404) {
      return 'The selected user was not found anymore. Refresh and try again.';
    }

    return 'An unexpected API error occurred.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}
