-- Seed Initial Admin User and Storage Accounts
INSERT INTO users (id, email, username, password_hash, display_name, role, status, is_verified)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'vasanth@wavemusic.dpdns.org',
  'VASANTH V',
  'VASAnth@2008',
  'VASANTH V',
  'SUPER_ADMIN',
  'ACTIVE',
  TRUE
) ON CONFLICT (email) DO UPDATE SET 
  username = 'VASANTH V',
  password_hash = 'VASAnth@2008',
  display_name = 'VASANTH V';

INSERT INTO users (id, email, username, password_hash, display_name, role, status, is_verified)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'creator@platform.io',
  'cinematic_studios',
  'creator123',
  'Cinematic Studios',
  'CREATOR',
  'ACTIVE',
  TRUE
) ON CONFLICT (email) DO NOTHING;

-- Initial Storage Accounts for R2
INSERT INTO storage_accounts (id, display_name, account_id, endpoint, access_key_id, secret_access_key_encrypted, status)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Cloudflare Production Account Alpha',
  'cf-alpha-account',
  'https://cf-alpha.r2.cloudflarestorage.com',
  'cf_key_alpha_primary',
  'encrypted_secret_placeholder',
  'ACTIVE'
) ON CONFLICT DO NOTHING;

INSERT INTO storage_accounts (id, display_name, account_id, endpoint, access_key_id, secret_access_key_encrypted, status)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'Cloudflare Production Account Beta',
  'cf-beta-account',
  'https://cf-beta.r2.cloudflarestorage.com',
  'cf_key_beta_secondary',
  'encrypted_secret_placeholder',
  'ACTIVE'
) ON CONFLICT DO NOTHING;

-- Storage buckets are dynamically added via Admin Console (Clean State)
DELETE FROM storage_buckets WHERE bucket_name LIKE 'prod-media-%';
