/**
 * Typed result for server actions with obvious error handling.
 *
 * All server actions should return ActionResult<T> so errors are:
 * - Visible: Returned to UI for display
 * - Typed: Consumers know to check for errors
 * - Logged: Console.error with context
 * - Actionable: Users see what failed
 *
 * @example
 * // Simple action:
 * export async function getData(): Promise<ActionResult<Data[]>> {
 *   return runAction('getData', () => repo.find());
 * }
 *
 * // Cached action:
 * export async function getCachedData(state: string): Promise<ActionResult<Data[]>> {
 *   return runCachedAction('getCachedData', () => repo.find(state), [`data-${state}`], { revalidate: 60 });
 * }
 *
 * // In component:
 * const result = await getData();
 * if (!result.success) {
 *   setError(result.error);
 *   return;
 * }
 * const data = result.data;
 */

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Create a successful result
 */
export function success<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/**
 * Create a failure result with error message
 */
export function failure(error: string): ActionResult<never> {
  return { success: false, error };
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: ActionResult<T>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if result is a failure
 */
export function isFailure<T>(result: ActionResult<T>): result is { success: false; error: string } {
  return result.success === false;
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Run a server action with standardized error handling.
 * Wraps try/catch + console.error + success/failure.
 */
export async function runAction<T>(
  name: string,
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return success(data);
  } catch (error) {
    console.error(`[${name}]`, error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Run a cached server action with standardized error handling.
 * Wraps unstable_cache + try/catch + console.error + success/failure.
 */
export async function runCachedAction<T>(
  name: string,
  fn: () => Promise<T>,
  cacheKey: string[],
  options?: { revalidate?: number | false; tags?: string[] }
): Promise<ActionResult<T>> {
  try {
    const { unstable_cache } = await import('next/cache');
    const cachedFn = unstable_cache(fn, cacheKey, options);
    const data = await cachedFn();
    return success(data);
  } catch (error) {
    console.error(`[${name}]`, error);
    return failure(getErrorMessage(error));
  }
}
