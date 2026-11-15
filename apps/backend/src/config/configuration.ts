import * as dotenv from 'dotenv';
import { DEFAULT_LOGICAL_QUOTA_BYTES, DEFAULT_CHUNK_SIZE_BYTES } from '@platform/common';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'antigravity-unified-platform-super-secret-jwt-key-32chars',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'antigravity-unified-platform-refresh-key-32chars',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/media_platform',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Storage Quota Defaults (8 GiB logical quota)
  defaultLogicalQuotaBytes: parseInt(
    process.env.STORAGE_LOGICAL_QUOTA_BYTES || String(DEFAULT_LOGICAL_QUOTA_BYTES),
    10
  ),
  defaultChunkSizeBytes: parseInt(
    process.env.STORAGE_CHUNK_SIZE_BYTES || String(DEFAULT_CHUNK_SIZE_BYTES),
    10
  ),

  // Initial Cloudflare R2 Accounts (optional from environment)
  r2Accounts: [
    {
      displayName: process.env.R2_ACC1_DISPLAY_NAME || 'Cloudflare R2 Primary',
      accountId: process.env.R2_ACC1_ACCOUNT_ID || 'cf-account-alpha',
      endpoint: process.env.R2_ACC1_ENDPOINT || 'https://cf-account-alpha.r2.cloudflarestorage.com',
      accessKeyId: process.env.R2_ACC1_ACCESS_KEY_ID || 'mock_r2_key_alpha',
      secretAccessKey: process.env.R2_ACC1_SECRET_ACCESS_KEY || 'mock_r2_secret_alpha',
      monthlyBudgetUsd: parseFloat(process.env.R2_ACC1_BUDGET_USD || '50.00')
    },
    {
      displayName: process.env.R2_ACC2_DISPLAY_NAME || 'Cloudflare R2 Secondary',
      accountId: process.env.R2_ACC2_ACCOUNT_ID || 'cf-account-beta',
      endpoint: process.env.R2_ACC2_ENDPOINT || 'https://cf-account-beta.r2.cloudflarestorage.com',
      accessKeyId: process.env.R2_ACC2_ACCESS_KEY_ID || 'mock_r2_key_beta',
      secretAccessKey: process.env.R2_ACC2_SECRET_ACCESS_KEY || 'mock_r2_secret_beta',
      monthlyBudgetUsd: parseFloat(process.env.R2_ACC2_BUDGET_USD || '50.00')
    }
  ]
};
