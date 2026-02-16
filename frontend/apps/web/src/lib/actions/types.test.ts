import { describe, it, expect } from 'vitest';
import { success, failure, isSuccess, isFailure, getErrorMessage } from './types';

describe('success', () => {
  it('creates a success result with data', () => {
    const result = success(42);
    expect(result).toEqual({ success: true, data: 42 });
  });

  it('works with object data', () => {
    const result = success({ name: 'test' });
    expect(result).toEqual({ success: true, data: { name: 'test' } });
  });
});

describe('failure', () => {
  it('creates a failure result with error message', () => {
    const result = failure('Something went wrong');
    expect(result).toEqual({ success: false, error: 'Something went wrong' });
  });
});

describe('isSuccess', () => {
  it('returns true for success results', () => {
    expect(isSuccess(success('data'))).toBe(true);
  });

  it('returns false for failure results', () => {
    expect(isSuccess(failure('error'))).toBe(false);
  });
});

describe('isFailure', () => {
  it('returns true for failure results', () => {
    expect(isFailure(failure('error'))).toBe(true);
  });

  it('returns false for success results', () => {
    expect(isFailure(success('data'))).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('oops'))).toBe('oops');
  });

  it('returns string errors directly', () => {
    expect(getErrorMessage('something failed')).toBe('something failed');
  });

  it('returns generic message for unknown types', () => {
    expect(getErrorMessage(123)).toBe('An unexpected error occurred');
  });

  it('returns generic message for null', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
  });
});
