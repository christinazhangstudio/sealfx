// Load from environment variables instead of hardcoding
export const AUTH_PRIVATE_KEY = process.env.AUTH_PRIVATE_KEY || '';
export const AUTH_PUBLIC_KEY = process.env.AUTH_PUBLIC_KEY || '';

if (!AUTH_PRIVATE_KEY) {
  console.warn('AUTH_PRIVATE_KEY is not set in environment variables');
}
if (!AUTH_PUBLIC_KEY) {
  console.warn('AUTH_PUBLIC_KEY is not set in environment variables');
}

