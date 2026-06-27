import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/currency_formatter';

describe('formatCurrency', () => {
  it('formats basic peso amount', () => {
    expect(formatCurrency(1000)).toBe('₱1,000.00');
  });

  it('formats millions', () => {
    expect(formatCurrency(1000000)).toBe('₱1,000,000.00');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('₱0.00');
  });

  it('formats decimal amounts', () => {
    expect(formatCurrency(99.5)).toBe('₱99.50');
  });

  it('handles NaN', () => {
    expect(formatCurrency(NaN)).toBe('₱0.00');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-250)).toBe('₱-250.00');
  });

  it('formats small amounts', () => {
    expect(formatCurrency(0.5)).toBe('₱0.50');
  });
});

describe('formatPercentage', () => {
  it('formats whole number', () => {
    expect(formatPercentage(50)).toBe('50.0%');
  });

  it('formats decimal', () => {
    expect(formatPercentage(12.34)).toBe('12.3%');
  });

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0.0%');
  });

  it('handles NaN', () => {
    expect(formatPercentage(NaN)).toBe('0.0%');
  });
});

describe('formatNumber', () => {
  it('formats with thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('handles NaN', () => {
    expect(formatNumber(NaN)).toBe('0');
  });
});
