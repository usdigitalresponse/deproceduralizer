/**
 * Type-safe bridge for Select -> nuqs. Since Radix Select returns string
 * but nuqs setters expect union types, this narrows the callback type.
 * The cast is safe because Select options constrain possible values.
 */
export function typedValue<T extends string>(
  handler: (value: T) => void
): (value: string) => void {
  return handler as (value: string) => void;
}
