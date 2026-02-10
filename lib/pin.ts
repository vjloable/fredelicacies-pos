/**
 * PIN hashing and verification utility.
 * Uses SHA-256 with a static salt for hashing 4-digit PINs.
 * Brute-force is mitigated by Firestore security rules + rate limiting at the UI level.
 */

const PIN_SALT = 'fredelicacies-pos-pin-v1';

/**
 * Hash a PIN string using SHA-256 with a salt.
 * Works in both browser and Node.js (via Web Crypto API).
 */
export async function hashPin(pin: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(`${PIN_SALT}:${pin}`);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a PIN against a stored hash.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
	const hash = await hashPin(pin);
	return hash === storedHash;
}

/**
 * Validate that a PIN meets requirements (4 digits, numeric only).
 */
export function validatePin(pin: string): { valid: boolean; error?: string } {
	if (!pin) return { valid: false, error: 'PIN is required' };
	if (!/^\d+$/.test(pin)) return { valid: false, error: 'PIN must contain only numbers' };
	if (pin.length !== 4) return { valid: false, error: 'PIN must be exactly 4 digits' };
	
	// Reject trivially weak PINs
	const weak = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321'];
	if (weak.includes(pin)) return { valid: false, error: 'PIN is too simple. Choose a stronger PIN.' };
	
	return { valid: true };
}
