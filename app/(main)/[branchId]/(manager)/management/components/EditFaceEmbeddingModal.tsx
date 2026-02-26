"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Worker } from "@/services/workerService";
import { faceRecognitionService, FaceRecognitionResult } from "@/services/faceRecognitionService";

interface EditFaceEmbeddingModalProps {
	isOpen: boolean;
	worker: Worker | null;
	onClose: () => void;
	onSuccess: () => void;
}

export default function EditFaceEmbeddingModal({
	isOpen,
	worker,
	onClose,
	onSuccess,
}: EditFaceEmbeddingModalProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	
	const [isLoading, setIsLoading] = useState(false);
	const [showCamera, setShowCamera] = useState(false);
	const [hasExistingEmbedding, setHasExistingEmbedding] = useState<boolean | null>(null);
	const [embeddingCount, setEmbeddingCount] = useState<number>(0);
	const [checkingEmbedding, setCheckingEmbedding] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [countdown, setCountdown] = useState<number | null>(null);
	const [status, setStatus] = useState<string>('');
	const [cameraError, setCameraError] = useState<string | null>(null);
	const [replaceMode, setReplaceMode] = useState(false);

	// Check if worker has existing embedding when modal opens
	React.useEffect(() => {
		const checkExistingEmbedding = async () => {
			if (!isOpen || !worker) {
				setHasExistingEmbedding(null);
				setEmbeddingCount(0);
				return;
			}

			setCheckingEmbedding(true);
			try {
				const data = await faceRecognitionService.getUserFaceEmbeddings(worker.id);
				const exists = data !== null && data.embeddings.length > 0;
				const count = data ? data.embeddings.length : 0;
				console.log('📸 Existing embedding check for', worker.name, ':', exists, `(${count} embeddings)`);
				setHasExistingEmbedding(exists);
				setEmbeddingCount(count);
			} catch (error) {
				console.error('❌ Error checking existing embedding:', error);
				setHasExistingEmbedding(false);
				setEmbeddingCount(0);
			} finally {
				setCheckingEmbedding(false);
			}
		};

		checkExistingEmbedding();
	}, [isOpen, worker]);

	// Initialize camera when showing camera view
	useEffect(() => {
		if (!showCamera || !worker) return;

		const startCamera = async () => {
			try {
				setStatus('Requesting camera access...');
				setCameraError(null);
				
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
						setIsLoading(false);
						setStatus('Position your face in the frame');
					};
				}
			} catch (error) {
				console.error('❌ Camera error:', error);
				setCameraError('Failed to access camera. Please check permissions.');
				setIsLoading(false);
			}
		};

		// Load models and start camera
		const init = async () => {
			try {
				setIsLoading(true);
				await faceRecognitionService.loadModels();
				await startCamera();
			} catch (error) {
				console.error('❌ Initialization error:', error);
				setCameraError('Failed to initialize face recognition');
				setIsLoading(false);
			}
		};

		init();

		// Cleanup
		return () => {
			if (streamRef.current) {
				streamRef.current.getTracks().forEach(track => track.stop());
				streamRef.current = null;
			}
		};
	}, [showCamera, worker]);

	// Countdown effect
	useEffect(() => {
		if (countdown === null || countdown === 0) return;

		const timer = setTimeout(() => {
			setCountdown(countdown - 1);
		}, 1000);

		return () => clearTimeout(timer);
	}, [countdown]);

	// Capture when countdown reaches 0
	useEffect(() => {
		if (countdown === 0 && !isProcessing) {
			handleCapture();
		}
	}, [countdown, isProcessing]);

	const handleStartEnrollment = () => {
		console.log('🎬 Starting face enrollment for', worker?.name);
		setShowCamera(true);
		setIsLoading(true);
		setStatus('Initializing...');
	};

	const handleStartCountdown = () => {
		setCountdown(3);
		setStatus('Hold still...');
	};

	const handleCapture = async () => {
		if (!videoRef.current || !canvasRef.current || !worker || isProcessing) return;

		setIsProcessing(true);
		setStatus('Capturing and processing face...');

		try {
			const canvas = canvasRef.current;
			const video = videoRef.current;
			
			// Set canvas size to match video
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			
			// Draw current video frame to canvas
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Failed to get canvas context');
			
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

			// Detect face and get descriptor
			console.log('🔍 Detecting face...');
			const descriptor = await faceRecognitionService.detectFaceAndGetDescriptor(canvas);

			if (!descriptor) {
				throw new Error('No face detected. Please ensure your face is clearly visible and try again.');
			}

			console.log('✅ Face detected, saving enrollment...');
			setStatus('Face detected! Saving...');

			// Save the embedding (replace all if replaceMode is true, otherwise add to collection)
			await faceRecognitionService.saveFaceEmbedding(worker.id, descriptor, undefined, replaceMode);

			console.log('✅ Face enrollment successful!');
			const message = replaceMode 
				? 'Success! All previous embeddings replaced.' 
				: `Success! Face enrolled (${embeddingCount + 1}/5).`;
			setStatus(message);

			// Stop camera
			if (streamRef.current) {
				streamRef.current.getTracks().forEach(track => track.stop());
				streamRef.current = null;
			}

			// Show success and close
			setTimeout(() => {
				alert(`Face enrollment successful for ${worker.name}!`);
				setShowCamera(false);
				setCountdown(null);
				setIsProcessing(false);
				onSuccess();
				onClose();
			}, 1000);

		} catch (error) {
			console.error('❌ Capture error:', error);
			const errorMessage = error instanceof Error ? error.message : 'Face capture failed';
			setCameraError(errorMessage);
			setCountdown(null);
			setIsProcessing(false);
			setStatus('Ready to capture');
		}
	};

	const handleCameraCancel = () => {
		console.log('❌ Face enrollment cancelled');
		
		// Stop camera
		if (streamRef.current) {
			streamRef.current.getTracks().forEach(track => track.stop());
			streamRef.current = null;
		}
		
		setShowCamera(false);
		setCountdown(null);
		setIsProcessing(false);
		setIsLoading(false);
		setCameraError(null);
		setStatus('');
	};

	const handleDeleteEmbedding = async () => {
		if (!worker) return;

		const confirmed = confirm(
			`Are you sure you want to delete the face enrollment for ${worker.name}? They will need to re-enroll before they can clock in/out.`
		);

		if (!confirmed) return;

		setIsLoading(true);
		try {
			await faceRecognitionService.deleteFaceEmbedding(worker.id);
			console.log('🗑️ Face embedding deleted for', worker.name);
			alert(`Face enrollment deleted for ${worker.name}`);
			setHasExistingEmbedding(false);
			onSuccess();
		} catch (error) {
			console.error('❌ Error deleting face embedding:', error);
			alert('Failed to delete face enrollment');
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen || !worker) return null;

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            {/* Modal panel */}
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-secondary">
                            Face Enrollment
                        </h2>
                        <p className="text-sm text-secondary/70 mt-1">
                            Manage face recognition for {worker.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-secondary/40 hover:text-secondary/60 p-2">
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

                {/* Body */}
                <div>
                    {checkingEmbedding ? (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-4 border-dashed border-accent"></div>
                            </div>
                            <h3 className="text-xl font-bold text-secondary mb-2">
                                Checking Status...
                            </h3>
                            <p className="text-secondary opacity-70">
                                Verifying enrollment status
                            </p>
                        </div>
                    ) : showCamera ? (
                        /* Camera View */
                        <div className="space-y-5">
                            {/* Camera Preview */}
                            <div className="relative bg-black rounded-2xl overflow-hidden shadow-xl" style={{ aspectRatio: '16/9' }}>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                    style={{ transform: 'scaleX(-1)' }}
                                />
                                <canvas ref={canvasRef} className="hidden" />
                                
                                {/* Overlay */}
                                <div className="absolute inset-0 pointer-events-none">
                                    {/* Face guide overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="relative w-64 h-80 border-4 border-white/60 rounded-full shadow-2xl">
                                            {/* Corner indicators */}
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                                            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                                            <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                                        </div>
                                    </div>

                                    {/* Countdown overlay */}
                                    {countdown !== null && countdown > 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                                            <div className="text-white text-9xl font-bold animate-pulse drop-shadow-2xl">
                                                {countdown}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status */}
                            <div className="text-center py-2">
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent" />
                                        <span className="text-sm font-medium text-secondary">{status}</span>
                                    </div>
                                ) : cameraError ? (
                                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-4 rounded-xl font-medium">
                                        {cameraError}
                                    </div>
                                ) : (
                                    <div className="text-sm font-medium text-secondary/80">{status}</div>
                                )}
                            </div>

                            {/* Camera Controls */}
                            <div className="flex gap-3 pt-4 border-t border-secondary/20">
                                <button
                                    onClick={handleCameraCancel}
                                    disabled={isProcessing}
                                    className="flex-1 px-4 py-3.5 bg-gray-100 text-secondary rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 font-semibold border border-secondary/20">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleStartCountdown}
                                    disabled={isLoading || isProcessing || countdown !== null || !!cameraError}
                                    className="flex-1 px-4 py-3.5 bg-accent text-primary rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm hover:shadow-md">
                                    {isProcessing ? 'Processing...' : countdown !== null ? 'Capturing...' : 'Capture Face'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Status and Actions View */
                        <>
                            {/* Status Display */}
                            <div className="mb-6 p-5 bg-(--success)/10 rounded-xl border border-(--success)">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-4 h-4 rounded-full ${
                                                hasExistingEmbedding
                                                    ? "bg-(--success) shadow-lg shadow-(--success)/50 animate-pulse"
                                                    : "bg-gray-300"
                                            }`}
                                        />
                                        <div>
                                            <p className="text-sm font-semibold text-secondary">
                                                Enrollment Status
                                            </p>
                                            <p className="text-xs text-secondary/70 mt-0.5">
                                                {hasExistingEmbedding
                                                    ? `${embeddingCount} face capture${embeddingCount !== 1 ? 's' : ''} enrolled`
                                                    : "No face data found"}
                                            </p>
                                        </div>
                                    </div>
                                    {hasExistingEmbedding && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs px-3 py-1.5 bg-(--success) text-white rounded-full font-semibold shadow-sm">
                                                Active
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Information */}
                            <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-xl">
                                <div className="flex gap-3">
                                    <svg
                                        className="w-5 h-5 text-accent shrink-0 mt-0.5"
                                        fill="currentColor"
                                        viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    <div className="text-sm text-secondary">
                                        <p className="font-semibold mb-2">Quick Tips:</p>
                                        <ul className="space-y-1 text-xs text-secondary/80">
                                            <li className="flex items-start gap-2">
                                                <span className="text-accent mt-0.5">•</span>
                                                <span>Multiple captures improve accuracy (max 5)</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-accent mt-0.5">•</span>
                                                <span>Capture from different angles & lighting</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-accent mt-0.5">•</span>
                                                <span>
                                                    {embeddingCount >= 5
                                                        ? "Max reached - replace to start fresh"
                                                        : embeddingCount > 0
                                                        ? "Add more captures for better results"
                                                        : "Start with at least one capture"}
                                                </span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3 pt-6 border-t border-secondary/20">
                                {hasExistingEmbedding ? (
                                    <>
                                        {/* Add More Button (only if less than 5) */}
                                        {embeddingCount < 5 && (
                                            <button
                                                onClick={() => {
                                                    setReplaceMode(false);
                                                    handleStartEnrollment();
                                                }}
                                                disabled={isLoading}
                                                className="w-full bg-accent text-3.5 text-primary px-4 py-3.5 rounded-xl hover:bg-accent/50 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md">
                                                <svg
                                                    className="w-5 h-5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M12 4v16m8-8H4"
                                                    />
                                                </svg>
                                                Add More Face Captures <span className="text-3 text-accent bg-primary rounded-full px-3 py-1">{embeddingCount}/5</span>
                                            </button>
                                        )}
                                        
                                        {/* Replace All Button */}
                                        <button
                                            onClick={() => {
                                                setReplaceMode(true);
                                                handleStartEnrollment();
                                            }}
                                            disabled={isLoading}
                                            className="w-full bg-accent/10 text-3.5 text-accent px-4 py-3.5 rounded-xl hover:bg-accent/50 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-2 border-accent hover:border-accent">
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                />
                                            </svg>
                                            Replace All Embeddings
                                        </button>

                                        {/* Delete Button */}
                                        <button
                                            onClick={handleDeleteEmbedding}
                                            disabled={isLoading}
                                            className="w-full bg-(--error)/10 text-3.5 text-(--error) px-4 py-3.5 rounded-xl hover:bg-(--error)/50 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-2 border-(--error) hover:border-(--error)">
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                            Delete Face Data
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setReplaceMode(false);
                                            handleStartEnrollment();
                                        }}
                                        disabled={isLoading}
                                        className="w-full bg-accent text-3.5 text-primary px-4 py-3.5 rounded-xl hover:bg-accent/90 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md">
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                        Enroll First Face Capture
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
	);
}
