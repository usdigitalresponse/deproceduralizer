import { describe, it, expect, vi } from 'vitest';
import { success, failure, isSuccess, isFailure, getErrorMessage, runAction, runCachedAction } from './types';

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

describe('runAction', () => {
  it('returns success when fn resolves', async () => {
    const result = await runAction('test', async () => 42);
    expect(result).toEqual({ success: true, data: 42 });
  });

  it('returns success with complex data', async () => {
    const data = { items: [1, 2, 3], total: 3 };
    const result = await runAction('test', async () => data);
    expect(result).toEqual({ success: true, data });
  });

  it('returns failure when fn rejects (does not throw)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await runAction('failAction', async () => {
      throw new Error('db connection failed');
    });
    expect(result).toEqual({ success: false, error: 'db connection failed' });
    expect(consoleSpy).toHaveBeenCalledWith('[failAction]', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('handles non-Error throws gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await runAction('stringThrow', async () => {
      throw 'raw string error';
    });
    expect(result).toEqual({ success: false, error: 'raw string error' });
    consoleSpy.mockRestore();
  });
});

describe('runCachedAction', () => {
  it('returns success when fn resolves', async () => {
    const mockUnstableCache = vi.fn((fn: () => Promise<number>) => fn);
    vi.doMock('next/cache', () => ({
      unstable_cache: mockUnstableCache,
    }));

    const result = await runCachedAction(
      'cachedTest',
      async () => 99,
      ['test-key'],
      { revalidate: 60 }
    );
    expect(result).toEqual({ success: true, data: 99 });
  });

  it('returns failure when fn rejects (does not throw)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockUnstableCache = vi.fn((fn: () => Promise<never>) => fn);
    vi.doMock('next/cache', () => ({
      unstable_cache: mockUnstableCache,
    }));

    const result = await runCachedAction(
      'cachedFail',
      async () => { throw new Error('cache miss + db fail'); },
      ['fail-key']
    );
    expect(result).toEqual({ success: false, error: 'cache miss + db fail' });
    expect(consoleSpy).toHaveBeenCalledWith('[cachedFail]', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('passes cacheKey and options to unstable_cache', async () => {
    const innerFn = async () => 'data';
    const mockUnstableCache = vi.fn((_fn: () => Promise<string>) => innerFn);
    vi.doMock('next/cache', () => ({
      unstable_cache: mockUnstableCache,
    }));

    await runCachedAction(
      'optsTest',
      innerFn,
      ['my-cache-key'],
      { revalidate: 120, tags: ['my-tag'] }
    );
    expect(mockUnstableCache).toHaveBeenCalledWith(
      innerFn,
      ['my-cache-key'],
      { revalidate: 120, tags: ['my-tag'] }
    );
  });
});
