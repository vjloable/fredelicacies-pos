'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { uploadToSupabase } from '@/lib/supabaseStorage';
import LoadingSpinner from '@/components/LoadingSpinner';
import SafeImage from '@/components/SafeImage';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { user, refreshUserData, getUserHierarchyLevel } = useAuth();

    const [loading, setLoading] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        phone_number: '',
        profile_picture: '',
    });

    useEffect(() => {
        if (isOpen && user) {
            setFormData({
                name: user.name || '',
                display_name: user.display_name || '',
                phone_number: user.phone_number || '',
                profile_picture: user.profile_picture || '',
            });
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, user]);

    if (!isOpen || !user) return null;

    const roleLabel = {
        owner: 'Owner',
        manager: 'Manager',
        worker: 'Worker',
    }[getUserHierarchyLevel() ?? 'worker'];

    // First letter placeholder — uses current form name so it updates live as user types
    const avatarLetter = (formData.name || user.email).trim()[0]?.toUpperCase() ?? '?';

    const handleAvatarClick = () => {
        if (!avatarUploading && !loading) fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
            setError('Please select a JPG or PNG image.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('Image must be under 10 MB.');
            return;
        }

        setAvatarUploading(true);
        setError(null);
        try {
            const result = await uploadToSupabase(file, 'profile-images');
            setFormData((p) => ({ ...p, profile_picture: result.publicUrl }));
        } catch {
            setError('Failed to upload photo. Please try again.');
        } finally {
            setAvatarUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Name is required.');
            return;
        }

        setLoading(true);
        setError(null);

        const { error: updateError } = await authService.updateUserProfile(user.id, {
            name: formData.name.trim(),
            display_name: formData.display_name.trim() || undefined,
            phone_number: formData.phone_number.trim() || undefined,
            profile_picture: formData.profile_picture || undefined,
        });

        if (updateError) {
            setError('Failed to save profile. Please try again.');
            setLoading(false);
            return;
        }

        await refreshUserData();
        setSuccess(true);
        setLoading(false);
        setTimeout(onClose, 800);
    };

    return (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'>
            <div className='bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto'>
                {/* Header */}
                <div className='flex items-center justify-between mb-6'>
                    <div>
                        <h2 className='text-xl font-bold text-secondary'>My Profile</h2>
                        <p className='text-xs text-secondary/70 mt-1'>Update your name, photo, and contact info</p>
                    </div>
                    <button
                        type='button'
                        onClick={onClose}
                        disabled={loading}
                        className='text-secondary/40 hover:text-secondary/60 transition-colors disabled:opacity-30'
                    >
                        <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                        </svg>
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className='mb-5 p-3 bg-error/10 border border-error/20 rounded-lg'>
                        <span className='text-xs text-error'>{error}</span>
                    </div>
                )}

                {/* Success */}
                {success && (
                    <div className='mb-5 p-3 bg-success/10 border border-(--success)/20 rounded-lg'>
                        <span className='text-xs text-success'>Profile saved!</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className='space-y-5'>
                    {/* Avatar */}
                    <div className='flex flex-col items-center gap-2'>
                        <button
                            type='button'
                            onClick={handleAvatarClick}
                            disabled={avatarUploading || loading}
                            className='relative w-24 h-24 rounded-full bg-light-accent flex items-center justify-center overflow-hidden group cursor-pointer shrink-0 disabled:cursor-not-allowed'
                            title='Click to change photo'
                        >
                            {/* Image or letter */}
                            {formData.profile_picture ? (
                                <SafeImage src={formData.profile_picture} alt={avatarLetter} />
                            ) : (
                                <span className='text-4xl font-bold text-secondary select-none'>
                                    {avatarLetter}
                                </span>
                            )}

                            {/* Upload overlay */}
                            <span className='absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full'>
                                {avatarUploading ? (
                                    <LoadingSpinner size='sm' className='border-white' />
                                ) : (
                                    <>
                                        <svg className='w-5 h-5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' />
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 13a3 3 0 11-6 0 3 3 0 016 0z' />
                                        </svg>
                                        <span className='text-white text-xs font-medium'>Change</span>
                                    </>
                                )}
                            </span>
                        </button>

                        {/* Remove photo link */}
                        {formData.profile_picture && (
                            <button
                                type='button'
                                onClick={() => setFormData((p) => ({ ...p, profile_picture: '' }))}
                                disabled={loading || avatarUploading}
                                className='text-xs text-(--error)/70 hover:text-error transition-colors disabled:opacity-40'
                            >
                                Remove photo
                            </button>
                        )}

                        <input
                            ref={fileInputRef}
                            type='file'
                            accept='image/jpeg,image/jpg,image/png'
                            onChange={handleFileChange}
                            className='hidden'
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className='block text-xs font-medium text-secondary mb-1.5'>
                            Full Name <span className='text-error'>*</span>
                        </label>
                        <input
                            type='text'
                            value={formData.name}
                            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                            placeholder='Your full name'
                            disabled={loading}
                            className='w-full h-9.5 px-3 border-2 border-secondary/20 rounded-lg text-xs text-secondary placeholder:text-secondary/40 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 transition-colors'
                        />
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className='block text-xs font-medium text-secondary mb-1.5'>
                            Display Name <span className='text-xs text-secondary/50 ml-1'>(Optional)</span>
                        </label>
                        <input
                            type='text'
                            value={formData.display_name}
                            onChange={(e) => setFormData((p) => ({ ...p, display_name: e.target.value }))}
                            placeholder={formData.name.trim().split(' ')[0] || 'Nickname or alias'}
                            disabled={loading}
                            className='w-full h-9.5 px-3 border-2 border-secondary/20 rounded-lg text-xs text-secondary placeholder:text-secondary/40 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 transition-colors'
                        />
                        <p className='mt-1 text-2.5 text-secondary/40'>
                            Shown in the top bar and on receipts. Leave blank to use your first name.
                        </p>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className='block text-xs font-medium text-secondary mb-1.5'>
                            Phone Number <span className='text-xs text-secondary/50 ml-1'>(Optional)</span>
                        </label>
                        <input
                            type='tel'
                            value={formData.phone_number}
                            onChange={(e) => setFormData((p) => ({ ...p, phone_number: e.target.value }))}
                            placeholder='+63 9xx xxx xxxx'
                            disabled={loading}
                            className='w-full h-9.5 px-3 border-2 border-secondary/20 rounded-lg text-xs text-secondary placeholder:text-secondary/40 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 transition-colors'
                        />
                    </div>

                    {/* Read-only info */}
                    <div className='pt-1 border-t border-secondary/10 space-y-3'>
                        <div className='flex items-center justify-between'>
                            <span className='text-xs text-secondary/50'>Email</span>
                            <span className='text-xs text-secondary font-medium'>{user.email}</span>
                        </div>
                        <div className='flex items-center justify-between'>
                            <span className='text-xs text-secondary/50'>Role</span>
                            <span className='text-xs text-secondary font-medium'>{roleLabel}</span>
                        </div>
                        {user.employee_id && (
                            <div className='flex items-center justify-between'>
                                <span className='text-xs text-secondary/50'>Employee ID</span>
                                <span className='text-xs text-secondary font-medium'>{user.employee_id}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className='flex gap-3 pt-4 border-t border-secondary/20'>
                        <button
                            type='button'
                            onClick={onClose}
                            disabled={loading}
                            className='flex-1 py-3 px-4 border border-secondary/30 rounded-lg text-xs font-medium text-secondary hover:bg-secondary/5 transition-colors disabled:opacity-50'
                        >
                            Cancel
                        </button>
                        <button
                            type='submit'
                            disabled={loading || avatarUploading}
                            className='flex-1 py-3 px-4 bg-accent text-primary rounded-lg text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                        >
                            {loading ? (
                                <>
                                    <LoadingSpinner size='sm' />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
