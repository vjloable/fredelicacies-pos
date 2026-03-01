"use client";

import { useState, useCallback } from "react";
import { workerService } from "@/services/workerService";
import { validatePin } from "@/lib/pin";
import LoadingSpinner from "@/components/LoadingSpinner";

interface PinEntryModalProps {
	userId: string;
	mode: "setup" | "verify";
	onSuccess: () => void;
	onCancel: () => void;
}

export default function PinEntryModal({
	userId,
	mode,
	onSuccess,
	onCancel,
}: PinEntryModalProps) {
	const [pin, setPin] = useState("");
	const [confirmPin, setConfirmPin] = useState("");
	const [step, setStep] = useState<"enter" | "confirm">("enter");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [attempts, setAttempts] = useState(0);

	const MAX_ATTEMPTS = 5;

	const handleKeyPress = useCallback(
		(digit: string) => {
			setError(null);
			if (step === "enter") {
				if (pin.length < 4) {
					setPin((prev) => prev + digit);
				}
			} else {
				if (confirmPin.length < 4) {
					setConfirmPin((prev) => prev + digit);
				}
			}
		},
		[step, pin.length, confirmPin.length]
	);

	const handleBackspace = useCallback(() => {
		setError(null);
		if (step === "enter") {
			setPin((prev) => prev.slice(0, -1));
		} else {
			setConfirmPin((prev) => prev.slice(0, -1));
		}
	}, [step]);

	const handleClear = useCallback(() => {
		setError(null);
		if (step === "enter") {
			setPin("");
		} else {
			setConfirmPin("");
		}
	}, [step]);

	const handleSubmit = useCallback(async () => {
		if (loading) return;

		if (mode === "setup") {
			if (step === "enter") {
				// Validate the PIN
				const validation = validatePin(pin);
				if (!validation.valid) {
					setError(validation.error || "Invalid PIN");
					setPin("");
					return;
				}
				// Move to confirm step
				setStep("confirm");
				return;
			}

			// Confirm step
			if (pin !== confirmPin) {
				setError("PINs do not match. Try again.");
				setConfirmPin("");
				return;
			}

			// Save the PIN
			setLoading(true);
			try {
				await workerService.setWorkerPin(userId, pin);
				onSuccess();
			} catch {
				setError("Failed to save PIN. Please try again.");
			} finally {
				setLoading(false);
			}
		} else {
			// Verify mode
			if (pin.length !== 4) {
				setError("Enter your 4-digit PIN");
				return;
			}

			setLoading(true);
			try {
				const isValid = await workerService.verifyWorkerPin(userId, pin);
				if (isValid) {
					onSuccess();
				} else {
					const newAttempts = attempts + 1;
					setAttempts(newAttempts);
					if (newAttempts >= MAX_ATTEMPTS) {
						setError("Too many failed attempts. Please try again later.");
						setTimeout(onCancel, 2000);
					} else {
						setError(
							`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`
						);
					}
					setPin("");
				}
			} catch {
				setError("Verification failed. Please try again.");
				setPin("");
			} finally {
				setLoading(false);
			}
		}
	}, [
		mode,
		step,
		pin,
		confirmPin,
		userId,
		attempts,
		loading,
		onSuccess,
		onCancel,
	]);

	// Auto-submit when 4 digits entered
	const currentPin = step === "enter" ? pin : confirmPin;

	const title =
		mode === "setup"
			? step === "enter"
				? "Create Your PIN"
				: "Confirm Your PIN"
			: "Enter Your PIN";

	const subtitle =
		mode === "setup"
			? step === "enter"
				? "Choose a 4-digit PIN for clocking in & out"
				: "Re-enter your PIN to confirm"
			: "Enter your 4-digit PIN to continue";

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="bg-primary rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
				{/* Header */}
				<div className="bg-accent px-6 py-5 text-center">
					<div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
						<svg
							className="w-7 h-7 text-white"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
							/>
						</svg>
					</div>
					<h2 className="text-lg font-bold text-white">{title}</h2>
					<p className="text-white/80 text-xs mt-1">{subtitle}</p>
				</div>

				{/* PIN Dots */}
				<div className="px-6 pt-6 pb-2">
					<div className="flex justify-center gap-4 mb-2">
						{[0, 1, 2, 3].map((i) => (
							<div
								key={i}
								className={`w-4 h-4 rounded-full transition-all duration-200 ${
									i < currentPin.length
										? "bg-accent scale-110"
										: "bg-light-accent border-2 border-accent/30"
								}`}
							/>
						))}
					</div>

					{/* Error Message */}
					{error && (
						<div className="mt-3 px-3 py-2 bg-error/10 border border-error/20 rounded-lg">
							<p className="text-error text-xs text-center font-medium">
								{error}
							</p>
						</div>
					)}
				</div>

				{/* Keypad */}
				<div className="px-6 pb-4 pt-2">
					<div className="grid grid-cols-3 gap-3">
						{["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
							<button
								key={digit}
								onClick={() => handleKeyPress(digit)}
								disabled={loading || currentPin.length >= 4}
								className="h-16 rounded-xl bg-background text-secondary text-xl font-semibold hover:bg-light-accent active:scale-95 transition-all duration-150 disabled:opacity-40 cursor-pointer">
								{digit}
							</button>
						))}
						<button
							onClick={handleClear}
							disabled={loading}
							className="h-16 rounded-xl bg-background text-secondary text-xs font-medium hover:bg-light-accent active:scale-95 transition-all duration-150 cursor-pointer">
							Clear
						</button>
						<button
							onClick={() => handleKeyPress("0")}
							disabled={loading || currentPin.length >= 4}
							className="h-16 rounded-xl bg-background text-secondary text-xl font-semibold hover:bg-light-accent active:scale-95 transition-all duration-150 disabled:opacity-40 cursor-pointer">
							0
						</button>
						<button
							onClick={handleBackspace}
							disabled={loading}
							className="h-16 rounded-xl bg-background text-secondary text-xs font-medium hover:bg-light-accent active:scale-95 transition-all duration-150 cursor-pointer flex items-center justify-center">
							<svg
								className="w-6 h-6"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l7-7 11 0v14H10L3 12z"
								/>
							</svg>
						</button>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="px-6 pb-6 flex gap-3">
					<button
						onClick={onCancel}
						disabled={loading}
						className="flex-1 h-12 rounded-xl border-2 border-secondary/20 text-secondary font-semibold hover:bg-background transition-all cursor-pointer disabled:opacity-50">
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						disabled={loading || currentPin.length < 4}
						className="flex-1 h-12 rounded-xl bg-accent text-white font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center">
						{loading ? (
							<LoadingSpinner className="border-white" />
						) : mode === "setup" && step === "enter" ? (
							"Next"
						) : (
							"Confirm"
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
