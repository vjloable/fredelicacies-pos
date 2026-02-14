import { supabase } from './supabase';

export interface SupabaseUploadResult {
  path: string;
  publicUrl: string;
  bucket: string;
}

/**
 * Upload a file to Supabase Storage
 * @param file - The file to upload
 * @param bucket - The storage bucket name ('branch-logos' | 'inventory-images' | 'bundle-images')
 * @param path - Optional path prefix (defaults to root)
 * @returns Upload result with path and public URL
 */
export const uploadToSupabase = async (
  file: File,
  bucket: 'branch-logos' | 'inventory-images' | 'bundle-images',
  path?: string
): Promise<SupabaseUploadResult> => {
  // Generate unique filename
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = path ? `${path}/${fileName}` : fileName;

  // Upload file to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl,
    bucket,
  };
};
