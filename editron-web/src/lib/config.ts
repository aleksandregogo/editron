// Configuration for client-side components
export const config = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000',
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
} as const 