/**
 * Check if keyboard event target is an interactive element that should capture input.
 * Used to prevent keyboard shortcuts from firing when the user is typing.
 */
export function isInteractiveElement(e: KeyboardEvent): boolean {
  const target = e.target;

  // Check standard form elements
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  // Check for contentEditable elements
  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  // Check for Radix UI dropdowns and other ARIA widgets
  if (target instanceof HTMLElement) {
    const role = target.getAttribute('role');
    if (role === 'combobox' || role === 'listbox' || role === 'option') {
      return true;
    }

    // Check if inside an open Radix Select portal
    if (
      target.closest('[data-radix-select-viewport]') ||
      target.closest('[role="listbox"]')
    ) {
      return true;
    }
  }

  return false;
}
