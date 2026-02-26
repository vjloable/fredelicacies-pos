import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
	title: "404 - Page Not Found | Fredelicacies POS",
	description: "The page you're looking for could not be found.",
};

export default function GlobalNotFound() {
	return (
		<html>
			<body>
				<div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100'>
					<div className='text-center max-w-lg mx-auto px-6'>
						{/* 404 Header */}
						<div className='mb-8'>
							<div className='relative'>
								<div className='text-9xl font-bold text-accent/20 mb-4'>404</div>
								<div className='absolute inset-0 flex items-center justify-center'>
									<div className='w-32 h-32 bg-accent/10 rounded-full flex items-center justify-center animate-pulse'>
										<svg 
											className='w-16 h-16 text-accent' 
											fill='none' 
											stroke='currentColor' 
											viewBox='0 0 24 24'
										>
											<path 
												strokeLinecap='round' 
												strokeLinejoin='round' 
												strokeWidth={1.5} 
												d='M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' 
											/>
										</svg>
									</div>
								</div>
							</div>
						</div>

						{/* Error Message */}
						<div className='mb-10'>
							<h1 className='text-4xl font-bold text-secondary mb-4'>
								Page Not Found
							</h1>
							<p className='text-xl text-secondary/70 mb-4'>
								Sorry, we couldn&apos;t find the page you&apos;re looking for.
							</p>
							<p className='text-base text-secondary/50'>
								The page may have been moved, deleted, or you may have mistyped the URL.
							</p>
						</div>

						{/* Action Buttons */}
						<div className='space-y-6'>
							<div className='flex flex-col sm:flex-row gap-4 justify-center'>
								<Link
									href='/'
									className='flex items-center justify-center gap-2 bg-accent text-primary px-8 py-4 rounded-lg hover:bg-accent/90 transition-colors font-medium shadow-lg hover:shadow-xl text-lg'>
									<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' />
									</svg>
									Go Home
								</Link>
								
								<Link
									href='/login'
									className='flex items-center justify-center gap-2 bg-secondary/10 text-secondary px-8 py-4 rounded-lg hover:bg-secondary/20 transition-colors font-medium border border-secondary/20 text-lg'>
									<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' />
									</svg>
									Login
								</Link>
							</div>

							{/* Help Links */}
							<div className='pt-6 border-t border-secondary/10'>
								<p className='text-sm text-secondary/50 mb-4'>Common pages you might be looking for:</p>
								<div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
									<Link
										href='/owner'
										className='text-sm text-accent hover:text-accent/80 py-2 px-4 rounded-md hover:bg-accent/10 transition-colors border border-accent/20'>
										Dashboard
									</Link>
									<Link
										href='/owner/branches'
										className='text-sm text-accent hover:text-accent/80 py-2 px-4 rounded-md hover:bg-accent/10 transition-colors border border-accent/20'>
										Branches
									</Link>
									<Link
										href='/owner/users'
										className='text-sm text-accent hover:text-accent/80 py-2 px-4 rounded-md hover:bg-accent/10 transition-colors border border-accent/20'>
										Users
									</Link>
								</div>
							</div>
						</div>

						{/* Branding */}
						<div className='mt-12 pt-8 border-t border-secondary/10'>
							<p className='text-xs text-secondary/40'>
								© 2025 Fredelicacies POS System
							</p>
						</div>

						{/* Decorative Animation */}
						<div className='mt-8 flex justify-center'>
							<div className='flex space-x-2'>
								<div className='w-2 h-2 bg-accent/30 rounded-full animate-bounce [animation-delay:-0.3s]'></div>
								<div className='w-2 h-2 bg-accent/50 rounded-full animate-bounce [animation-delay:-0.15s]'></div>
								<div className='w-2 h-2 bg-accent rounded-full animate-bounce'></div>
							</div>
						</div>
					</div>
				</div>
			</body>
		</html>
	);
}