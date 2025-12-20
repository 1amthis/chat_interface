/**
 * File handling utilities for upload, conversion, and validation
 */

/** Maximum file size in bytes (20MB) */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Accepted image MIME types */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/** All accepted file MIME types */
export const ACCEPTED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/pdf',
  ...ACCEPTED_IMAGE_TYPES,
];

/**
 * Convert a File to base64 string (without data URL prefix)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a MIME type is an image type
 */
export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
