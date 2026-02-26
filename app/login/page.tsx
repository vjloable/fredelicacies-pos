"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LogoVerticalIcon from "@/components/icons/LogoVerticalIcon";
import Link from "next/link";
import VersionDisplay from "@/components/VersionDisplay";

function LoginContent() {
	const [credentials, setCredentials] = useState({
		email: "",
		password: "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, login, isUserOwner } = useAuth();

	useEffect(() => {
		// Check for email confirmation status from URL params
		const confirmed = searchParams.get("confirmed");
		const errorParam = searchParams.get("error");
		const messageParam = searchParams.get("message");

		if (confirmed === "true") {
			setSuccessMessage("Email confirmed successfully! You can now log in.");
			// Clear URL params
			window.history.replaceState({}, "", "/login");
		} else if (errorParam) {
			setError(decodeURIComponent(messageParam || "Email confirmation failed. Please try again."));
			// Clear URL params
			window.history.replaceState({}, "", "/login");
		}
	}, [searchParams]);

	useEffect(() => {
		// If user is already logged in, redirect based on their role
		if (user) {
			if (isUserOwner()) {
				// Owner redirects to branch management
				setIsLoading(false);
				router.push("/owner/branches");
			} else if (user.roleAssignments.length > 0) {
				// Check if user has valid branch assignmentsgit
				const branchId = user?.roleAssignments?.[0]?.branchId;
				if (branchId) {
					// Check if user is a manager for any branch
					const isManager = user.roleAssignments.some(
						(assignment) =>
							assignment.role === "manager" && assignment.isActive !== false
					);

					if (isManager) {
						// Manager redirects to management (worker view for their branch)
						router.push(`/${branchId}/management`);
					} else {
						// Worker redirects to store
						router.push(`/${branchId}/store`);
					}
					setIsLoading(false);
				}
			} else {
				// User has no role assignments, send to waiting room
				setIsLoading(false);
				router.push('/waiting-room');
			}
		}
	}, [user, router, isUserOwner]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		// Simple validation
		if (!credentials.email || !credentials.password) {
			setError("Please enter both email and password");
			setIsLoading(false);
			return;
		}

		try {
			await login(credentials.email, credentials.password);
			// After successful login, redirect based on user role
			// Note: The user state will be updated, and the useEffect will handle the redirect
		} catch (error) {
			console.error("Login error:", error);

			// Handle authentication errors
			let errorMessage = "Login failed. Please try again.";
			
			if (error && typeof error === 'object' && 'message' in error) {
				const message = String(error.message).toLowerCase();
				
				if (message.includes('email confirmation') || message.includes('user profile not found')) {
					errorMessage = "Please confirm your email address first. Check your inbox for the confirmation link.";
				} else if (message.includes('invalid') && (message.includes('email') || message.includes('password') || message.includes('credential'))) {
					errorMessage = "Invalid email or password.";
				} else if (message.includes('not found') || message.includes('user')) {
					errorMessage = "No account found with this email address.";
				} else if (message.includes('disabled')) {
					errorMessage = "This account has been disabled.";
				} else if (message.includes('many') && message.includes('request')) {
					errorMessage = "Too many failed attempts. Please try again later.";
				} else {
					errorMessage = String(error.message);
				}
			}

			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const handleInputChange =
		(field: "email" | "password") =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setCredentials((prev) => ({
				...prev,
				[field]: e.target.value,
			}));
			// Clear error and success messages when user starts typing
			if (error) setError("");
			if (successMessage) setSuccessMessage("");
		};

	return (
		<div
			className='min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8'
			style={{
				backgroundImage: "url('/cover.png')",
				backgroundSize: "cover",
				backgroundPosition: "center",
				backgroundRepeat: "no-repeat",
			}}>
			<div className='w-full max-w-md'>
				{/* Login Form */}
				<div className='bg-white rounded-xl shadow-xl'>
					{/* Logo/Header */}
					<div className='text-center mb-8'>
						<div className='w-full h-full mx-auto mb-4 flex items-center justify-center bg-primary py-6 shadow-md rounded-t-xl'>
							<div className='w-41.25 h-30'>
								<LogoVerticalIcon />
							</div>
						</div>
					</div>
					<p className='text-center text-4 font-medium text-secondary'>
						Sign in to your account
					</p>
					<div className='p-8'>
						<form onSubmit={handleSubmit} className='space-y-6'>
							{/* Email Field */}
							<div>
								<label className='block text-sm font-medium text-secondary mb-2'>
									Email
								</label>
								<input
									type='email'
									value={credentials.email}
									onChange={handleInputChange("email")}
									className='w-full px-4 py-3 border-2 border-gray-200 rounded-md text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'
									placeholder='Enter your email'
									disabled={isLoading}
									autoComplete='email'
								/>
							</div>

							{/* Password Field */}
							<div>
								<label className='block text-sm font-medium text-secondary mb-2'>
									Password
								</label>
								<input
									type='password'
									value={credentials.password}
									onChange={handleInputChange("password")}
									className='w-full px-4 py-3 border-2 border-gray-200 rounded-md text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'
									placeholder='Enter your password'
									disabled={isLoading}
									autoComplete='current-password'
								/>
							</div>

							{/* Success Message */}
							{successMessage && (
								<div className='bg-green-50 border border-green-200 rounded-xl p-3'>
									<div className='flex items-center gap-2'>
										<svg
											className='w-5 h-5 text-green-600'
											fill='currentColor'
											viewBox='0 0 20 20'>
											<path
												fillRule='evenodd'
												d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
												clipRule='evenodd'
											/>
										</svg>
										<span className='text-sm text-green-600'>{successMessage}</span>
									</div>
								</div>
							)}

							{/* Error Message */}
							{error && (
								<div className='bg-red-50 border border-red-200 rounded-xl p-3'>
									<div className='flex items-center gap-2'>
										<svg
											className='w-5 h-5 text-(--error)'
											fill='currentColor'
											viewBox='0 0 20 20'>
											<path
												fillRule='evenodd'
												d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
												clipRule='evenodd'
											/>
										</svg>
										<span className='text-sm text-(--error)'>{error}</span>
									</div>
								</div>
							)}

							{/* Submit Button */}
							<button
								type='submit'
								disabled={isLoading}
								className={`w-full py-3 rounded-md font-semibold transition-all shadow-lg ${
									isLoading
										? "bg-gray-300 text-gray-500 cursor-not-allowed"
										: "bg-accent hover:bg-(--accent)/90 text-white hover:scale-105 active:scale-95"
								}`}>
								{isLoading ? (
									<div className='flex items-center justify-center gap-2'>
										<div className='w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin'></div>
										Signing in...
									</div>
								) : (
									"SIGN IN"
								)}
							</button>
						</form>

						{/* Sign Up Link */}
						<div className='mt-6 text-center'>
							<p className='text-sm text-secondary'>
								Do not have an account?{' '}
								<Link
									href='/signup'
									className='font-medium text-accent hover:text-(--accent)/80 transition-colors'>
									Create account
								</Link>
							</p>
						</div>

						{/* Footer */}
						<div className='mt-6 text-center'>
							<p className='text-xs text-secondary opacity-50'>
							Fredelicacies Point-of-Sales System <VersionDisplay variant="simple" />
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		}>
			<LoginContent />
		</Suspense>
	);
}
