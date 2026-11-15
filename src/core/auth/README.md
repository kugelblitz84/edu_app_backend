# Browser authentication

The API returns short-lived access tokens in JSON and keeps refresh tokens in an
HttpOnly cookie. Protected API routes still use
`Authorization: Bearer <accessToken>`.

## Endpoints

- `POST /api/v1/auth/login` returns the user, `accessToken`, `tokenType`,
  `expiresIn`, and a `csrfToken`. It sets `__Secure-refresh_token` in a
  `Set-Cookie` response header.
- `GET /api/v1/auth/csrf` returns a fresh `csrfToken` for a browser that has a
  refresh cookie but has reloaded and lost its in-memory CSRF token.
- `POST /api/v1/auth/refresh` reads the refresh token from the cookie, requires
  the CSRF token in `X-CSRF-Token`, rotates the refresh token, updates the
  cookie, and returns a new access token and CSRF token.
- `POST /api/v1/auth/logout` requires the CSRF header when a refresh cookie is
  present, revokes the session, and clears the cookie. It can be used after the
  access token expires.

Browser clients must include credentials on login, CSRF, refresh, and logout
requests (`credentials: 'include'` with `fetch`). Keep the access token and CSRF
token in memory, send the access token as a bearer header on protected routes,
and send the CSRF token in `X-CSRF-Token` on refresh and logout. On page reload,
request `/api/v1/auth/csrf` before attempting a refresh.

The refresh cookie is host-only, `HttpOnly`, `Secure`, and scoped to
`/api/v1/auth`. `AUTH_COOKIE_SAME_SITE` defaults to `lax`; set it to `none` only
when the browser app and API are on different sites. `SameSite=none` requires
HTTPS. The app origin must also be listed exactly in `CORS_ORIGINS`.
