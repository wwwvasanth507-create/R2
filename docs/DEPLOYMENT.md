# Deployment & Operations Guide

## 1. Prerequisites
- Docker & Docker Compose (v20.10+)
- PostgreSQL 16+
- Redis 7+
- Node.js 20+ / 22+ / 26+
- Cloudflare R2 Account with API Token (Object Read & Write permissions)

---

## 2. Docker Compose Deployment

The entire system can be launched locally or in staging via Docker Compose:

```bash
# Clone the repository
git clone <repository-url>
cd R2

# Configure environment variables
cp .env.example .env

# Build and start all services
docker compose -f docker/docker-compose.yml up -d --build
```

### Services Started:
- `backend`: NestJS REST API, dynamic storage allocator, Range streaming gateway (port `4000`)
- `web`: Next.js consumer web application (port `3000`)
- `admin`: Next.js admin dashboard (port `3001`)
- `worker`: FFmpeg background video processing cluster
- `postgres`: PostgreSQL 16 database (port `5432`)
- `redis`: Redis cache & BullMQ queue (port `6379`)

---

## 3. Environment Variables Reference (`.env.example`)

```ini
# Application
NODE_ENV=production
PORT=4000
API_URL=http://localhost:4000
WEB_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
JWT_SECRET=replace_with_a_super_secure_random_key_min_32_chars
REFRESH_TOKEN_SECRET=replace_with_another_super_secure_random_key

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres_secure_pass@localhost:5432/media_platform?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Cloudflare R2 Account 1 (Primary)
R2_ACC1_DISPLAY_NAME=Cloudflare Production Account A
R2_ACC1_ACCOUNT_ID=your_cloudflare_account_id_1
R2_ACC1_ENDPOINT=https://your_cloudflare_account_id_1.r2.cloudflarestorage.com
R2_ACC1_ACCESS_KEY_ID=your_access_key_id_1
R2_ACC1_SECRET_ACCESS_KEY=your_secret_access_key_1
R2_ACC1_BUDGET_USD=50.00

# Cloudflare R2 Account 2 (Secondary / Spillover)
R2_ACC2_DISPLAY_NAME=Cloudflare Production Account B
R2_ACC2_ACCOUNT_ID=your_cloudflare_account_id_2
R2_ACC2_ENDPOINT=https://your_cloudflare_account_id_2.r2.cloudflarestorage.com
R2_ACC2_ACCESS_KEY_ID=your_access_key_id_2
R2_ACC2_SECRET_ACCESS_KEY=your_secret_access_key_2
R2_ACC2_BUDGET_USD=50.00

# Storage Allocation Defaults
STORAGE_LOGICAL_QUOTA_BYTES=8589934592 # 8 GiB
STORAGE_CHUNK_SIZE_BYTES=268435456     # 256 MiB
```

---

## 4. How to Register a New Authorized Cloudflare Account
1. Open the Admin Dashboard at `http://localhost:3001` as Super Admin.
2. Navigate to **Storage Accounts** -> **Add Account**.
3. Enter the Cloudflare Account ID, S3-Compatible Endpoint, Access Key ID, and Secret Key.
4. Click **Validate & Register**. The backend will test S3 connectivity with a lightweight `HeadBucket` / `ListBuckets` check.
5. The account is immediately ready for bucket registration without redeploying any apps.

---

## 5. How to Register a New Bucket
1. Navigate to **Buckets** -> **Add Bucket**.
2. Select the parent Cloudflare Account.
3. Enter the R2 Bucket Name.
4. Set the **Logical Quota** (defaults to 8 GiB).
5. Set the **Allocation Priority** (1 = primary, 2 = secondary, etc.).
6. Click **Activate**. The dynamic bucket allocation engine automatically incorporates the bucket into future upload plans.
