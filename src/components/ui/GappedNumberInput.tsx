'use client';

import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { formatNumberWithGaps, parseNumberFromGaps } from '@/lib/formatters/numberGaps';

export interface GappedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string | number;
  onChange: (formattedValue: string, numericValue: number) => void;
  maxAmount?: number;
  allowDecimals?: boolean;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const GappedNumberInput = React.forwardRef<HTMLInputElement, GappedNumberInputProps>(
  (
    {
      value,
      onChange,
      maxAmount = 1_000_000_000_000, // 1 trillion UZS limit to prevent overflows
      allowDecimals = true,
      placeholder = '0',
      className = '',
      inputMode = 'decimal',
      onKeyDown,
      ...rest
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = (forwardedRef as React.RefObject<HTMLInputElement>) || internalRef;
    const cursorDigitsBeforeRef = useRef<number | null>(null);

    const formattedValue =
      typeof value === 'number'
        ? value > 0
          ? formatNumberWithGaps(value)
          : value === 0
          ? '0'
          : ''
        : formatNumberWithGaps(value);

    // Restore cursor position seamlessly after React state updates and re-renders
    useIsomorphicLayoutEffect(() => {
      const el = inputRef.current;
      if (el && cursorDigitsBeforeRef.current !== null) {
        const digitsTarget = cursorDigitsBeforeRef.current;
        let digitCount = 0;
        let targetPos = el.value.length;

        for (let i = 0; i < el.value.length; i++) {
          if (/\d/.test(el.value[i])) {
            digitCount++;
          }
          if (digitCount === digitsTarget) {
            targetPos = i + 1;
            break;
          }
        }

        if (digitsTarget === 0) {
          targetPos = 0;
        }

        try {
          el.setSelectionRange(targetPos, targetPos);
        } catch {
          // Ignore if input is not focused
        }
        cursorDigitsBeforeRef.current = null;
      }
    }, [formattedValue, inputRef]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (onKeyDown) onKeyDown(e);
      if (e.defaultPrevented) return;

      // Handle Backspace when cursor is directly after a space gap
      if (e.key === 'Backspace') {
        const input = e.currentTarget;
        const { selectionStart, selectionEnd, value: currentVal } = input;
        if (
          selectionStart !== null &&
          selectionStart === selectionEnd &&
          selectionStart > 0
        ) {
          if (currentVal[selectionStart - 1] === ' ') {
            e.preventDefault();
            // Erase the digit preceding the space
            const before = currentVal.slice(0, selectionStart - 2);
            const after = currentVal.slice(selectionStart);
            const rawNew = before + after;
            const newFormatted = formatNumberWithGaps(rawNew);
            const newNumeric = parseNumberFromGaps(newFormatted);

            const digitsBefore = before.replace(/\D/g, '').length;
            cursorDigitsBeforeRef.current = digitsBefore;

            onChange(newFormatted, newNumeric);
          }
        }
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      let rawInput = input.value;

      if (!allowDecimals) {
        rawInput = rawInput.replace(/[.,].*$/, '');
      }

      const cursor = input.selectionStart || 0;
      const rawBeforeCursor = rawInput.slice(0, cursor);
      const digitsBefore = rawBeforeCursor.replace(/\D/g, '').length;

      const newFormatted = formatNumberWithGaps(rawInput);
      const newNumeric = parseNumberFromGaps(newFormatted);

      if (maxAmount && newNumeric > maxAmount) {
        return;
      }

      cursorDigitsBeforeRef.current = digitsBefore;
      onChange(newFormatted, newNumeric);
    };

    return (
      <input
        ref={inputRef}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={formattedValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        {...rest}
      />
    );
  }
);

GappedNumberInput.displayName = 'GappedNumberInput';
