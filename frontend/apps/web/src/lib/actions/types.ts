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
 * // In server action:
 * export async function getData(): Promise<ActionResult<Data[]>> {
 *   try {
 *     const data = await repo.find();
 *     return success(data);
 *   } catch (error) {
 *     console.error('[getData]', error);
 *     return failure('Failed to load data');
 *   }
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
