-- Email verification becomes required for new sign-ups. Accounts created
-- before that never got a verification email, so treat them as verified
-- rather than locking their owners out. Safe to run more than once.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
