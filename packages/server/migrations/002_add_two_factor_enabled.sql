-- Add twoFactorEnabled column required by Better Auth twoFactor plugin
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
