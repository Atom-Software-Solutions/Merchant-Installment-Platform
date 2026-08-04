# Auth Work Todo

## Priority tasks

- [x] Add activation-token validation for `purpose: 'activate-account'.`
- [x] Improve the `/auth/activate` browser flow to redirect to a user-friendly confirmation page instead of returning raw JSON.
- [x] Add controller/end-to-end tests for the full auth path:
  - register
  - activation email generation
  - activate via `/auth/activate?token=`
  - access protected endpoint before and after activation
- [x] Make the login response explicit for inactive users so clients can distinguish "unverified account" from "bad credentials".
- [ ] Add rate limiting/throttling on login and resend-activation endpoints to reduce abuse.

## Important enhancements

- [ ] Add a password reset / forgot-password flow.
- [ ] Normalize and validate input values for email and phone number before lookup/registration.
- [ ] Add a dedicated DTO for the resend-activation request.
- [ ] Add audit metadata for activation emails (e.g. `lastActivationSentAt`).
- [ ] Add token revocation or refresh-token support for stronger session handling.

## Optional polish

- [ ] Improve activation email content and subject for stronger brand consistency.
- [ ] Add centralized auth error translation or client-friendly error shapes.
- [ ] Harden JWT payload handling and avoid exposing any unnecessary claims.
- [ ] Add monitoring/logging around auth failures and activation email delivery.
