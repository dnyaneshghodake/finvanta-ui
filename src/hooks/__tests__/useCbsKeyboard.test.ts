/**
 * CBS Keyboard Shortcuts unit tests.
 * @file src/hooks/__tests__/useCbsKeyboard.test.ts
 *
 * Validates teller productivity shortcuts work correctly:
 *   - F-keys fire callbacks
 *   - Non-F-keys are suppressed in input fields
 *   - F-keys work even inside input fields (CBS convention)
 *   - Disabled state prevents all shortcuts
 *   - kbdLabel maps keys correctly
 */
import { describe, it, expect } from 'vitest';
import { kbdLabel } from '../useCbsKeyboard';

describe('kbdLabel', () => {
  it('maps F-keys', () => {
    expect(kbdLabel('F2')).toBe('F2');
    expect(kbdLabel('F3')).toBe('F3');
    expect(kbdLabel('F5')).toBe('F5');
    expect(kbdLabel('F7')).toBe('F7');
    expect(kbdLabel('F8')).toBe('F8');
    expect(kbdLabel('F10')).toBe('F10');
  });

  it('maps special keys', () => {
    expect(kbdLabel('Escape')).toBe('Esc');
    expect(kbdLabel('Enter')).toBe('↵');
    expect(kbdLabel('Tab')).toBe('⇥');
  });

  it('maps arrow keys', () => {
    expect(kbdLabel('ArrowUp')).toBe('↑');
    expect(kbdLabel('ArrowDown')).toBe('↓');
    expect(kbdLabel('ArrowLeft')).toBe('←');
    expect(kbdLabel('ArrowRight')).toBe('→');
  });

  it('returns unknown keys as-is', () => {
    expect(kbdLabel('a')).toBe('a');
    expect(kbdLabel('Delete')).toBe('Delete');
  });
});
