'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LogoVerticalIcon from '@/components/icons/LogoVerticalIcon';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ResetPasswordPage() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [ready, setReady] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setReady(true);
            }
        });

        // Also check if session already exists (user clicked link and session was auto-established)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setReady(true);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!newPassword || !confirmPassword) {
            setError('Please fill in both fields.');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        setLoading(false);

        if (updateError) {
            setError(updateError.message || 'Failed to reset password.');
            return;
        }

        setSuccess(true);
        await supabase.auth.signOut();
        setTimeout(() => router.push('/login?confirmed=true'), 1500);
    };

    return (
        <div
            className='min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8'
            style={{
                backgroundImage: "url('/cover.png')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            <div className='w-full max-w-md'>
                <div className='bg-white rounded-xl shadow-xl'>
                    <div className='text-center mb-8'>
                        <div className='w-full h-full mx-auto mb-4 flex items-center justify-center bg-primary py-6 shadow-md rounded-t-xl'>
                            <div className='w-41.25 h-30'>
                                <LogoVerticalIcon />
                            </div>
                        </div>
                    </div>
                    <p className='text-center text-3.5 font-medium text-secondary'>
                        Set your new password
                    </p>
                    <div className='p-8'>
                        {!ready && !success ? (
                            <div className='text-center py-8'>
                                <LoadingSpinner size='lg' />
                                <p className='text-xs text-secondary/60 mt-4'>Verifying reset link...</p>
                            </div>
                        ) : success ? (
                            <div className='space-y-6'>
                                <div className='bg-green-50 border border-green-200 rounded-xl p-4 text-center'>
                                    <svg className='w-8 h-8 text-green-600 mx-auto mb-2' fill='currentColor' viewBox='0 0 20 20'>
                                        <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
                                    </svg>
                                    <p className='text-xs text-green-700 font-medium'>Password reset successfully!</p>
                                    <p className='text-xs text-green-600 mt-1'>Redirecting to sign in...</p>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className='space-y-6'>
                                <div>
                                    <label className='block text-xs font-medium text-secondary mb-2'>New Password</label>
                                    <input
                                        type='password'
                                        value={newPassword}
                                        onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                                        className='w-full px-4 py-3 border-2 border-gray-200 rounded-md text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'
                                        placeholder='Enter new password (min 6 characters)'
                                        disabled={loading}
                                        autoComplete='new-password'
                                    />
                                </div>

                                <div>
                                    <label className='block text-xs font-medium text-secondary mb-2'>Confirm Password</label>
                                    <input
                                        type='password'
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                        className='w-full px-4 py-3 border-2 border-gray-200 rounded-md text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'
                                        placeholder='Re-enter new password'
                                        disabled={loading}
                                        autoComplete='new-password'
                                    />
                                </div>

                                {error && (
                                    <div className='bg-red-50 border border-red-200 rounded-xl p-3'>
                                        <div className='flex items-center gap-2'>
                                            <svg className='w-5 h-5 text-error' fill='currentColor' viewBox='0 0 20 20'>
                                                <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' clipRule='evenodd' />
                                            </svg>
                                            <span className='text-xs text-error'>{error}</span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type='submit'
                                    disabled={loading}
                                    className={`w-full py-3 rounded-md font-semibold transition-all shadow-lg ${
                                        loading
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-accent hover:bg-accent/90 text-white hover:scale-105 active:scale-95'
                                    }`}
                                >
                                    {loading ? (
                                        <div className='flex items-center justify-center gap-2'>
                                            <LoadingSpinner className='border-secondary/30' />
                                            Resetting...
                                        </div>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
