# Supabase Auth Setup Checklist

## 1. Email (Magic Link)
- [ ] Enable Email provider in Supabase Dashboard → Authentication → Providers
- [ ] Disable "Confirm email" for faster local dev (or use Inbucket at http://127.0.0.1:54324)

## 2. Google OAuth
1. Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com/)
2. Authorized redirect URI: `https://dbnoddzaqjgtfnymyqjm.supabase.co/auth/v1/callback`
3. Paste Client ID and Secret in Supabase → Authentication → Providers → Google

## 3. Redirect URLs
Add in Supabase → Authentication → URL Configuration:
- `http://localhost:3000/auth/callback`
- `https://ca-tempo.vercel.app/auth/callback`

Site URL: `https://ca-tempo.vercel.app` (production) or `http://localhost:3000` (local)

## 4. MFA (TOTP)
- [ ] Enable TOTP in Supabase → Authentication → Multi-Factor Authentication
- Owner/admin accounts are forced to enroll via `/auth/mfa` before accessing coach panel

## 5. Rate Limiting
- Supabase native: 5 emails/hour per address (default)
- App-level: Upstash Redis via middleware on `/auth/*` and `/login` (5 req/min per IP)

## 6. Environment Variables (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://dbnoddzaqjgtfnymyqjm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key from dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service role — server only>
NEXT_PUBLIC_SITE_URL=https://ca-tempo.vercel.app
```

## 7. Third-Party Services
| Service | Dashboard | Env vars |
|---------|-----------|----------|
| Sentry | sentry.io | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |
| PostHog | posthog.com | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| Upstash | upstash.com | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
