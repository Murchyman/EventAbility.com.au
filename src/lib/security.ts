// Security headers configuration
// In src/lib/security.ts, update the style-src directive
export const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://js.pusher.com https://cdnjs.cloudflare.com https://www.googletagmanager.com https://js.stripe.com https://app.cal.com https://*.cal.com",
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.s3.amazonaws.com https://www.w3.org/2000/svg https://media.socialspot.com.au",
    "font-src 'self'",
    "connect-src 'self' blob: https://*.pusher.com wss://*.pusher.com https://*.amazonaws.com https://*.googletagmanager.com https://api.stripe.com https://cal.com https://*.cal.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://app.cal.com https://*.cal.com",
    "media-src 'self' https://*.r2.cloudflarestorage.com https://*.s3.amazonaws.com https://media.socialspot.com.au",
    "object-src 'none'",
    "base-uri 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'"
  ].join('; '),
  // Rest of the headers remain the same

  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // XSS protection
  'X-XSS-Protection': '1; mode=block',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // HSTS - Force HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions Policy - restrict powerful features
  'Permissions-Policy': [
    'accelerometer=()',
    'camera=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()'
  ].join(', ')
}



