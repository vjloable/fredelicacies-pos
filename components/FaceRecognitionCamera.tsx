'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { faceRecognitionService, FaceRecognitionResult } from '@/services/faceRecognitionService';
import LoadingSpinner from './LoadingSpinner';

interface FaceRecognitionCameraProps {
	userId: string;
	mode: 'enroll' | 'verify';
	onSuccess: (result?: FaceRecognitionResult) => void;
	onCancel: () => void;
	onError: (error: string) => void;
}

export default function FaceRecognitionCamera({
	userId,
	mode,
	onSuccess,
	onCancel,
	onError,
}: FaceRecognitionCameraProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	
	const [isLoading, setIsLoading] = useState(true);
	const [isProcessing, setIsProcessing] = useState(false);
	const [countdown, setCountdown] = useState<number | null>(null);
	const [status, setStatus] = useState<string>('Initializing camera...');
	const [hasCamera, setHasCamera] = useState(true);

	// Initialize camera
	useEffect(() => {
		const startCamera = async () => {
			try {
				setStatus('Requesting camera access...');
				
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						width: { ideal: 1280 },
						height: { ideal: 720 },
						facingMode: 'user',
					},
					audio: false,
				});

				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					streamRef.current = stream;
					
					videoRef.current.onloadedmetadata = () => {
						videoRef.current?.play();
						setStatus('Camera ready. Position your face in the frame.');
						setIsLoading(false);
					};
				}

				// Load face recognition models
				setStatus('Loading face recognition models...');
				await faceRecognitionService.loadModels();
				setStatus('Ready! Position your face in the frame.');
			} catch (error) {
				console.error('Error starting camera:', error);
				setHasCamera(false);
				setIsLoading(false);
				onError('Failed to access camera. Please ensure camera permissions are granted.');
			}
		};

		startCamera();

		// Cleanup function
		return () => {
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
			}
		};
	}, [onError]);

	const captureAndProcess = useCallback(async () => {
		if (!videoRef.current || !canvasRef.current || isProcessing) return;

		setIsProcessing(true);
		setStatus('Processing...');

		try {
			const canvas = canvasRef.current;
			const video = videoRef.current;
			
			// Set canvas dimensions to match video
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			
			// Draw current video frame to canvas
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				throw new Error('Failed to get canvas context');
			}
			
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

			if (mode === 'enroll') {
				setStatus('Enrolling face...');
				const result = await faceRecognitionService.enrollFace(userId, canvas);
				
				if (result.success) {
					setStatus('Face enrolled successfully!');
					setTimeout(() => onSuccess(), 1000);
				} else {
					setStatus('Failed to enroll face');
					onError(result.error || 'Failed to detect face. Please try again.');
					setIsProcessing(false);
				}
			} else {
				setStatus('Verifying face...');
				const result = await faceRecognitionService.verifyFace(userId, canvas);
				
				if (result.success) {
					setStatus(`Verified! Confidence: ${(result.confidence * 100).toFixed(1)}%`);
					setTimeout(() => onSuccess(result), 1000);
				} else if (result.needsEnrollment) {
					setStatus('Face not enrolled');
					onError(result.error || 'Please enroll your face first.');
					setIsProcessing(false);
				} else {
					setStatus('Verification failed');
					onError(result.error || 'Face verification failed. Please try again.');
					setIsProcessing(false);
				}
			}
		} catch (error) {
			console.error('Error processing face:', error);
			onError('An error occurred during face processing.');
			setIsProcessing(false);
			setStatus('Error occurred');
		}
	}, [userId, mode, isProcessing, onSuccess, onError]);

	const handleCapture = useCallback(() => {
		if (isProcessing) return;

		// Start countdown
		setCountdown(3);
		const countdownInterval = setInterval(() => {
			setCountdown((prev) => {
				if (prev === null || prev <= 1) {
					clearInterval(countdownInterval);
					captureAndProcess();
					return null;
				}
				return prev - 1;
			});
		}, 1000);
	}, [isProcessing, captureAndProcess]);

	if (!hasCamera) {
		return (
			<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
				<div className="bg-[var(--primary)] rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
					<div className="text-center">
						<div className="w-16 h-16 bg-[var(--error)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
							<svg className="w-8 h-8 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</div>
						<h3 className="text-xl font-bold text-[var(--secondary)] mb-2">Camera Not Available</h3>
						<p className="text-[var(--secondary)]/70 mb-6">
							Unable to access your camera. Please ensure:
						</p>
						<ul className="text-left text-sm text-[var(--secondary)]/80 space-y-2.5 mb-6">
							<li className="flex items-start gap-2">
								<span className="text-[var(--accent)] mt-0.5">•</span>
								<span>Camera permissions are granted in your browser</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-[var(--accent)] mt-0.5">•</span>
								<span>Your device has a working camera</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-[var(--accent)] mt-0.5">•</span>
								<span>No other application is using the camera</span>
							</li>
						</ul>
						<button
							onClick={onCancel}
							className="w-full px-4 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--primary)] rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
			<div className="bg-[var(--primary)] rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-2xl font-bold text-[var(--secondary)]">
							{mode === 'enroll' ? 'Enroll Your Face' : 'Face Verification'}
						</h2>
						<p className="text-sm text-[var(--secondary)]/70 mt-1">
							{mode === 'enroll'
								? 'Position your face in the frame and capture to enroll'
								: 'Verify your identity to clock in/out'}
						</p>
					</div>
					<button
						onClick={onCancel}
						disabled={isProcessing}
						className="text-[var(--secondary)]/40 hover:text-[var(--secondary)]/60 p-2 disabled:opacity-50">
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* Camera View */}
				<div className="relative bg-black rounded-2xl overflow-hidden mb-5 shadow-xl" style={{ aspectRatio: '16/9' }}>
					<video
						ref={videoRef}
						autoPlay
						playsInline
						muted
						className="w-full h-full object-cover"
						style={{ transform: 'scaleX(-1)' }}
					/>
					
					{/* Hidden canvas for capture */}
					<canvas ref={canvasRef} className="hidden" />

					{/* Face outline guide */}
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<div className="w-64 h-80 border-4 border-[var(--primary)]/60 rounded-full shadow-2xl" />
					</div>

					{/* Countdown overlay */}
					{countdown !== null && (
						<div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
							<div className="text-[var(--primary)] text-9xl font-bold animate-pulse drop-shadow-2xl">
								{countdown}
							</div>
						</div>
					)}

					{/* Loading overlay */}
					{isLoading && (
						<div className="absolute inset-0 rounded-2xl bg-black/60 backdrop-blur-sm flex items-center justify-center">
							<div className="text-center">
								<div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--primary)] border-t-transparent mx-auto mb-4" />
								<p className="text-[var(--primary)] text-lg font-medium">Loading...</p>
							</div>
						</div>
					)}
				</div>

				{/* Status */}
				<div className="mb-5 text-center py-2">
					<div className={`flex items-center justify-center p-4 rounded-xl border ${
						isProcessing 
							? 'bg-[var(--accent)]/10 border-[var(--accent)]/20' 
							: status.includes('success') || status.includes('Verified') 
								? 'bg-[var(--success)]/10 border-[var(--success)]/20' 
								: status.includes('failed') || status.includes('Error') 
									? 'bg-[var(--error)]/10 border-[var(--error)]/20' 
									: 'bg-[var(--secondary)]/10 border-[var(--secondary)]/20'
					}`}>
						{isProcessing && (
							<LoadingSpinner size='md'/>
						)}
						<span className={`text-sm font-semibold ${
							isProcessing 
								? 'text-[var(--accent)]/60' 
								: status.includes('success') || status.includes('Verified') 
									? 'text-[var(--success)]/60' 
									: status.includes('failed') || status.includes('Error') 
										? 'text-[var(--error)]/60' 
										: 'text-[var(--secondary)]/60'
						}`}>
							{status}
						</span>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex gap-3 pt-6 border-t border-[var(--secondary)]/20 mb-4">
					<button
						onClick={onCancel}
						disabled={isProcessing}
						className="flex-1 py-3.5 px-4 border border-[var(--secondary)]/30 rounded-xl text-[var(--secondary)]/70 font-semibold hover:bg-[var(--secondary)]/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Cancel
					</button>
					<button
						onClick={handleCapture}
						disabled={isLoading || isProcessing || countdown !== null}
						className="flex-1 py-3.5 px-4 bg-[var(--accent)] text-[var(--primary)] rounded-xl font-semibold hover:bg-[var(--accent)]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
					>
						{isProcessing ? 'Processing...' : countdown !== null ? `Capturing in ${countdown}...` : mode === 'enroll' ? 'Capture & Enroll' : 'Verify Face'}
					</button>
				</div>

				{/* Instructions */}
				<div className="p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl">
					<div className="flex gap-3">
						<svg
							className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5"
							fill="currentColor"
							viewBox="0 0 20 20">
							<path
								fillRule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
								clipRule="evenodd"
							/>
						</svg>
						<div className="text-sm text-[var(--secondary)]">
							<p className="font-semibold mb-2">Quick Tips:</p>
							<ul className="space-y-1 text-xs text-[var(--secondary)]/80">
								<li className="flex items-start gap-2">
									<span className="text-[var(--accent)] mt-0.5">•</span>
									<span>Good lighting & clear visibility</span>
								</li>
								<li className="flex items-start gap-2">
									<span className="text-[var(--accent)] mt-0.5">•</span>
									<span>Face within the oval guide</span>
								</li>
								<li className="flex items-start gap-2">
									<span className="text-[var(--accent)] mt-0.5">•</span>
									<span>Look directly at camera</span>
								</li>
								<li className="flex items-start gap-2">
									<span className="text-[var(--accent)] mt-0.5">•</span>
									<span>Stay still during capture</span>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
