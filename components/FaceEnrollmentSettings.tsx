'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { faceRecognitionService } from '@/services/faceRecognitionService';
import FaceRecognitionCamera from '@/components/FaceRecognitionCamera';

export default function FaceEnrollmentSettings() {
	const { user } = useAuth();
	const [hasEnrollment, setHasEnrollment] = useState<boolean | null>(null);
	const [loading, setLoading] = useState(true);
	const [showCamera, setShowCamera] = useState(false);
	const [enrollmentDate, setEnrollmentDate] = useState<Date | null>(null);

	useEffect(() => {
		const checkEnrollment = async () => {
			if (!user) return;

			try {
				setLoading(true);
				const enrolled = await faceRecognitionService.hasEnrollment(user.uid);
				setHasEnrollment(enrolled);

				if (enrolled) {
					const embedding = await faceRecognitionService.getUserFaceEmbedding(user.uid);
					if (embedding) {
						setEnrollmentDate(embedding.capturedAt);
					}
				}
			} catch (error) {
				console.error('Error checking enrollment:', error);
			} finally {
				setLoading(false);
			}
		};

		checkEnrollment();
	}, [user]);

	const handleEnrollSuccess = () => {
		setShowCamera(false);
		setHasEnrollment(true);
		setEnrollmentDate(new Date());
	};

	const handleEnrollCancel = () => {
		setShowCamera(false);
	};

	const handleEnrollError = (error: string) => {
		alert(error);
	};

	if (loading) {
		return (
			<div className="bg-white rounded-lg border border-gray-200 p-6">
				<div className="flex items-center justify-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
				</div>
			</div>
		);
	}

	return (
		<>
			{showCamera && user && (
				<FaceRecognitionCamera
					userId={user.uid}
					mode="enroll"
					onSuccess={handleEnrollSuccess}
					onCancel={handleEnrollCancel}
					onError={handleEnrollError}
				/>
			)}

			<div className="bg-white rounded-lg border border-gray-200">
				<div className="px-6 py-4 border-b border-gray-200">
					<h3 className="text-lg font-semibold text-gray-900">Face Recognition</h3>
					<p className="text-sm text-gray-600 mt-1">
						Manage your face enrollment for clock in/out verification
					</p>
				</div>

				<div className="p-6">
					{hasEnrollment ? (
						<div className="space-y-4">
							{/* Enrollment Status */}
							<div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
								<div className="flex items-center">
									<div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
										<svg
											className="w-6 h-6 text-green-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
									</div>
									<div>
										<h4 className="font-medium text-green-900">Face Enrolled</h4>
										<p className="text-sm text-green-700">
											Your face is enrolled for clock in/out verification
										</p>
										{enrollmentDate && (
											<p className="text-xs text-green-600 mt-1">
												Enrolled on {enrollmentDate.toLocaleDateString()} at{' '}
												{enrollmentDate.toLocaleTimeString()}
											</p>
										)}
									</div>
								</div>
							</div>

							{/* Re-enroll Button */}
							<div className="flex flex-col space-y-2">
								<button
									onClick={() => setShowCamera(true)}
									className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
								>
									<svg
										className="w-5 h-5 mr-2"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
										/>
									</svg>
									Re-enroll Face
								</button>
								<p className="text-xs text-gray-500 text-center">
									Re-enroll if your appearance has changed significantly or if you're
									experiencing verification issues
								</p>
							</div>

							{/* Information */}
							<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
								<h5 className="text-sm font-semibold text-blue-900 mb-2">
									How Face Recognition Works
								</h5>
								<ul className="text-xs text-blue-700 space-y-1">
									<li>• Your face is used to verify your identity during clock in/out</li>
									<li>• Face data is stored securely and encrypted</li>
									<li>• 75% similarity required for successful verification</li>
									<li>• Works in various lighting conditions</li>
									<li>• Only you can access your face data</li>
								</ul>
							</div>
						</div>
					) : (
						<div className="space-y-4">
							{/* Not Enrolled Status */}
							<div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
								<div className="flex items-center">
									<div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
										<svg
											className="w-6 h-6 text-yellow-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
											/>
										</svg>
									</div>
									<div>
										<h4 className="font-medium text-yellow-900">Not Enrolled</h4>
										<p className="text-sm text-yellow-700">
											You need to enroll your face to use clock in/out
										</p>
									</div>
								</div>
							</div>

							{/* Enroll Button */}
							<button
								onClick={() => setShowCamera(true)}
								className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
							>
								<svg
									className="w-5 h-5 mr-2"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
									/>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
								Enroll My Face
							</button>

							{/* Instructions */}
							<div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
								<h5 className="text-sm font-semibold text-gray-900 mb-2">
									Before You Start
								</h5>
								<ul className="text-xs text-gray-700 space-y-1">
									<li>• Find a well-lit area</li>
									<li>• Remove glasses or hats if possible</li>
									<li>• Look directly at the camera</li>
									<li>• Stay still during capture</li>
									<li>• Allow camera permissions when prompted</li>
								</ul>
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
