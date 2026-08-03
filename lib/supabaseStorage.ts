import { supabase } from './supabase';

export interface SupabaseUploadResult {
  path: string;
  publicUrl: string;
  bucket: string;
}

type Bucket = 'branch-logos' | 'inventory-images' | 'bundle-images' | 'profile-images';

// Turn a human name (e.g. a branch name) into a safe storage key segment.
const sanitizeName = (name: string): string =>
  name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');

const extOf = (fileName: string): string => {
  const m = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return m ? m[1].toLowerCase() : 'png';
};

/**
 * Upload a file to Supabase Storage.
 * @param file - The file to upload
 * @param bucket - The storage bucket name
 * @param opts.path - Optional path prefix (defaults to root)
 * @param opts.objectName - Deterministic file name (without extension). When given,
 *   the object key is `<objectName>.<ext>` and the upload overwrites any existing
 *   object at that key (upsert). Used for branch logos so the file is named after the
 *   branch and replacing a logo reuses the same key instead of orphaning the old one.
 * @returns Upload result with path and public URL
 */
export const uploadToSupabase = async (
  file: File,
  bucket: Bucket,
  opts?: { path?: string; objectName?: string }
): Promise<SupabaseUploadResult> => {
  const path = opts?.path;
  const cleanName = opts?.objectName ? sanitizeName(opts.objectName) : '';

  // Deterministic name (upsert) when an objectName is given; otherwise a unique name.
  const fileName = cleanName
    ? `${cleanName}.${extOf(file.name)}`
    : `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = path ? `${path}/${fileName}` : fileName;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '31536000',
      upsert: Boolean(cleanName),
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return { path: filePath, publicUrl, bucket };
};

/**
 * Delete a storage object given its public URL. Best-effort — errors are logged, not
 * thrown, so a failed cleanup never blocks the surrounding save/remove flow. Used to
 * drop the previous logo when a branch logo is replaced or removed.
 */
export const deleteFromSupabaseUrl = async (publicUrl: string): Promise<void> => {
  try {
    // .../storage/v1/object/public/<bucket>/<path>
    const marker = '/storage/v1/object/public/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const rest = publicUrl.slice(idx + marker.length);
    const slash = rest.indexOf('/');
    if (slash === -1) return;
    const bucket = rest.slice(0, slash);
    const objectPath = decodeURIComponent(rest.slice(slash + 1).split('?')[0]);
    if (!bucket || !objectPath) return;

    const { error } = await supabase.storage.from(bucket).remove([objectPath]);
    if (error) console.error('Supabase delete error:', error);
  } catch (err) {
    console.error('Supabase delete (parse) error:', err);
  }
};
