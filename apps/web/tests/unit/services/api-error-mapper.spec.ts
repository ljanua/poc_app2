import { describe, expect, it } from 'vitest';
import { ApiError, mapApiErrorToMessage } from '../../../src/services/api/errors';

describe('api-error-mapper', () => {
  it('maps 404 and unknown errors to stable messages', () => {
    expect(mapApiErrorToMessage(new ApiError(404, 'not_found', 'Not found'))).toBe(
      'The selected user was not found anymore. Refresh and try again.'
    );

    expect(mapApiErrorToMessage(new ApiError(500, 'unknown', 'Server error'))).toBe(
      'An unexpected API error occurred.'
    );
  });

  it('maps generic Error and unknown input safely', () => {
    expect(mapApiErrorToMessage(new Error('network down'))).toBe('network down');
    expect(mapApiErrorToMessage(null)).toBe('An unexpected error occurred.');
  });
});
