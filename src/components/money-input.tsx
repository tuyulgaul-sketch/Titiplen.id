'use client';

import { useLayoutEffect, useRef } from 'react';
import { caretFromDigitCount, formatRupiahInput, parseRupiahInput } from '@/lib/currency';

type MoneyProps = {
  value: number;
  onChange: (amount: number) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * The operator sees "Rp 1.250.000" while application state / Supabase
 * receives the integer 1250000. Paste and middle-of-number edits work.
 */
export function Money({ value, onChange, disabled, placeholder }: MoneyProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = inputRef.current;
    const digits = pendingCaretDigits.current;
    if (!element || digits === null) return;
    pendingCaretDigits.current = null;

    if (document.activeElement === element) {
      const cursor = caretFromDigitCount(element.value, digits);
      element.setSelectionRange(cursor, cursor);
    }
  }, [value]);

  return (
    <div className="money-control">
      <span className="money-prefix" aria-hidden="true">Rp</span>
      <input
        ref={inputRef}
        className="money-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label="Nominal rupiah"
        spellCheck={false}
        value={formatRupiahInput(value)}
        disabled={disabled}
        placeholder={placeholder ?? '0'}
        onChange={(event) => {
          const element = event.currentTarget;
          const digitsLeft = element.value
            .slice(0, element.selectionStart ?? element.value.length)
            .replace(/\D/g, '').length;
          const parsed = parseRupiahInput(element.value);
          if (parsed === null) {
            // Ignore an amount beyond JavaScript's precise integer range.
            element.value = formatRupiahInput(value);
            return;
          }
          pendingCaretDigits.current = digitsLeft;
          onChange(parsed);
          if (parsed === value) {
            // A leading zero or deletion may not trigger a parent re-render.
            element.value = formatRupiahInput(value);
            const cursor = caretFromDigitCount(element.value, digitsLeft);
            element.setSelectionRange(cursor, cursor);
            pendingCaretDigits.current = null;
          }
        }}
      />
    </div>
  );
}
