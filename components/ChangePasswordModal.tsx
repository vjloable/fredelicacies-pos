'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen || !user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('All fields are required.');
            return;
        }
        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        setLoading(true);
        const { error: changeError } = await authService.changePassword(
            user.email,
            currentPassword,
            newPassword
        );
        setLoading(false);

        if (changeError) {
            setError(changeError.message || 'Failed to change password.');
            return;
        }

        setSuccess(true);
        setTimeout(() => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setSuccess(false);
            onClose();
        }, 800);
    };

    const handleClose = () => {
        if (loading) return;
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError(null);
        setSuccess(false);
        onClose();
    };

    return (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50' onClick={handleClose}>
            <div className='bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl' onClick={(e) => e.stopPropagation()}>
                <div className='flex items-center justify-between mb-6'>
                    <div>
                        <h2 className='text-xl font-bold text-secondary'>Change Password</h2>
                        <p className='text-xs text-secondary/70 mt-1'>Enter your current password and choose a new one</p>
                    </div>
                    <button
                        type='button'
                        onClick={handleClose}
                        disabled={loading}
                        className='text-secondary/40 hover:text-secondary/60 transition-colors disabled:opacity-30'
                    >
                        <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                        </svg>
                    </button>
                </div>

                {error && (
                    <div className='mb-5 p-3 bg-error/10 border border-error/20 rounded-lg'>
                        <span className='text-xs text-error'>{error}</span>
                    </div>
                )}

                {success && (
                    <div className='mb-5 p-3 bg-success/10 border border-(--success)/20 rounded-lg'>
                        <span className='text-xs text-success'>Password changed successfully!</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className='space-y-5'>
                    <div>
                        <label className='block text-xs font-medium text-secondary mb-1.5'>Current Password</label>
                        <input
                            type='password'
                            value={currentPassword}
                            onChange={(e) => { setCurrentPassword(e.target.value); setError(null); }}
                            placeholder='Enter current password'
                            disabled={loading}
                            autoComplete='current-password'
                            className='w-full h-9.5 px-3 border border-secondary/20 rounded-lg text-xs text-secondary placeholder:text-secondary/40 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 transition-colors'
                        />
                    </div>

                    <div>
                        <label className='block text-xs font-medium text-secondary mb-1.5'>New Password</label>
                        <input
                            type='password'
                            value={newPassword}
                            onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                            placeholder='Enter new password (min 6 characters)'
                            disabled={loading}
                            autoComplete='new-password'
                            className='w-full h-9.5 px-3 border border-secondary/20 rounded-lg text-xs text-secondary placeholder:text-secondary/40 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 transition-colors'
                        />
                    </div>

                    <div>
                        <label className='block text-xs font-medium text-secondary mb-1.5'>Confirm New Password</label>
                        <input
                            type='password'
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                            placeholder='Re-enter new password'
                            disabled={loading}
                            autoComplete='new-password'
                            className='w-full h-9.5 px-3 border border-secondary/20 rounded-lg text-xs text-secondary placeholder:text-secondary/40 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 transition-colors'
                        />
                    </div>

                    <div className='flex gap-3 pt-4 border-t border-secondary/20'>
                        <button
                            type='button'
                            onClick={handleClose}
                            disabled={loading}
                            className='flex-1 py-3 px-4 border border-secondary/30 rounded-lg text-xs font-medium text-secondary hover:bg-secondary/5 transition-colors disabled:opacity-50'
                        >
                            Cancel
                        </button>
                        <button
                            type='submit'
                            disabled={loading}
                            className='flex-1 py-3 px-4 bg-accent text-primary rounded-lg text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                        >
                            {loading ? (
                                <>
                                    <LoadingSpinner size='sm' />
                                    Changing...
                                </>
                            ) : (
                                'Change Password'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
