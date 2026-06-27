import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, validatePin } from '@/lib/pin';

describe('validatePin', () => {
  it('accepts valid 4-digit PIN', () => {
    expect(validatePin('2580')).toEqual({ valid: true });
  });

  it('rejects empty string', () => {
    const result = validatePin('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('PIN is required');
  });

  it('rejects non-numeric', () => {
    const result = validatePin('abcd');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('PIN must contain only numbers');
  });

  it('rejects too short', () => {
    const result = validatePin('12');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('PIN must be exactly 4 digits');
  });

  it('rejects too long', () => {
    const result = validatePin('12345');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('PIN must be exactly 4 digits');
  });

  it('rejects weak PINs', () => {
    const weakPins = ['0000', '1111', '1234', '4321', '9999'];
    for (const pin of weakPins) {
      const result = validatePin(pin);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too simple');
    }
  });

  it('accepts non-weak 4-digit PINs', () => {
    const strongPins = ['2580', '7391', '4826', '1379'];
    for (const pin of strongPins) {
      expect(validatePin(pin)).toEqual({ valid: true });
    }
  });
});

describe('hashPin', () => {
  it('produces a 64-char hex string (SHA-256)', async () => {
    const hash = await hashPin('2580');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces consistent hashes', async () => {
    const h1 = await hashPin('2580');
    const h2 = await hashPin('2580');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different PINs', async () => {
    const h1 = await hashPin('2580');
    const h2 = await hashPin('1379');
    expect(h1).not.toBe(h2);
  });
});

describe('verifyPin', () => {
  it('returns true for matching PIN', async () => {
    const hash = await hashPin('2580');
    expect(await verifyPin('2580', hash)).toBe(true);
  });

  it('returns false for wrong PIN', async () => {
    const hash = await hashPin('2580');
    expect(await verifyPin('9999', hash)).toBe(false);
  });
});
