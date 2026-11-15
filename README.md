# All-in-One Production Media Platform (Netflix + YouTube + Instagram)

[![Tests](https://img.shields.io/badge/Tests-Passing%20(10%2F10)-22c55e?style=for-the-badge&logo=node.js)](docs/TESTING.md)
[![Storage](https://img.shields.io/badge/Storage-Cloudflare%20R2%20Multi--Account-f97316?style=for-the-badge&logo=cloudflare)](docs/STORAGE.md)
[![Quota](https://img.shields.io/badge/Logical%20Quota-8%20GiB%20Per%20Bucket-3b82f6?style=for-the-badge)](docs/STORAGE.md)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2014%20%2B%20Flutter-6366f1?style=for-the-badge&logo=next.js)](apps/web)

A complete, production-grade unified media platform that synthesizes the premier user experiences of **Netflix** (movies, series, continue watching, watch history, watchlist, multi-audio/subtitles, adaptive HLS ABR streaming), **YouTube** (creator channels, video uploads, descriptions/thumbnails, likes/dislikes, comments/replies, subscriptions, view counters, vertical Shorts feed), and **Instagram** (user profiles, avatar/cover, photo/video posts, 24h stories, vertical reels, direct messaging, follow graph) backed by a cost-optimized, compliant **Cloudflare R2 Multi-Account Storage Engine**.

---

## 🌟 Core Technical Highlights

### 1. Centralized Multi-Account Cloudflare R2 Engine
- **Compliant Multi-Account Management**: Connect multiple legitimate, authorized Cloudflare accounts with encrypted credentials (AES-256-GCM) and monthly budget safeguards.
- **Dynamic Bucket Allocation**: Application-enforced **8 GiB logical quota per bucket** (`8 * 1024 * 1024 * 1024 = 8,589,934,592 bytes`).
- **Sequential Priority Allocation**: New data is sequentially assigned to the highest-priority eligible bucket until capacity is reached, seamlessly rolling over to the next bucket/account.
- **Storage Alert State Machine**: Automated thresholds at **70%** (notification), **85%** (high usage warning), and **100%** (stop allocation) with deduplication suppression.
- **Zero Client Updates**: Adding, updating, or reconfiguring storage accounts and buckets occurs entirely on the backend; mobile (Flutter) and Web apps never require app store updates.

### 2. Large-File Chunk Uploads (Up to 20 GB+)
- **Zero Server Memory Bottlenecks**: Large file bodies bypass the application server and stream directly from Flutter/Web clients to Cloudflare R2 using presigned URLs.
- **Distributed Spilling**: A 20 GiB file is split into 256 MiB chunks (80 chunks total) and distributed across multiple 8 GiB buckets (e.g. 32 chunks to Bucket A, 32 chunks to Bucket B, 16 chunks to Bucket C).
- **Resumability & Retries**: Interruptions at 18 GB only retry unverified chunks without restarting the upload.
- **Integrity**: End-to-end SHA-256 chunk and file verification.

### 3. HTTP Range Virtual Reassembly Download Gateway
- Allows distributed multi-bucket chunks to be accessed seamlessly as one single logical file.
- Handles partial content (`HTTP 206`), byte ranges (`Range: bytes=start-end`), and stream resume with bounded 64 KB buffers, never loading multi-gigabyte files into server RAM.

### 4. Adaptive HLS Video Transcoding Pipeline
- FFmpeg worker cluster generating multi-resolution profiles: **360p, 480p, 720p, 1080p**.
- Generates master HLS playlists (`.m3u8`) and fragmented `.ts` video segments stored across R2 buckets.
- Leverages Cloudflare CDN caching for near-zero startup buffering and $0 data egress.

---

## 📁 Repository Structure

```
/
├── apps/
│   ├── backend/             # NestJS REST API, dynamic storage allocator, Range streaming gateway
│   ├── web/                 # Next.js 14 Responsive Web App (Netflix + YouTube + Instagram + Uploader)
│   ├── admin/               # Next.js 14 Admin Dashboard (Multi-Account, Quota & Cost Console)
│   └── mobile/              # Flutter cross-platform mobile application (Android & iOS)
├── packages/
│   ├── common/              # Shared TypeScript definitions, DTOs, enums, byte constants
│   └── storage-engine/      # Cloudflare R2 provider, sequential allocation engine, Range gateway
├── docker/
│   ├── docker-compose.yml   # Multi-container production deployment stack
│   ├── Dockerfile.backend   # Backend Dockerfile
│   ├── Dockerfile.web       # Web client Dockerfile
│   └── Dockerfile.admin     # Admin dashboard Dockerfile
├── docs/
│   ├── ARCHITECTURE.md      # High-level architecture and system diagrams
│   ├── DATABASE.md          # Complete PostgreSQL schema, tables, indexes & manifest relationships
│   ├── STORAGE.md           # Cloudflare R2 multi-account storage, 8 GB quotas, sequential allocation
│   ├── UPLOADS.md           # Distributed chunking (256 MiB), resumability, SHA-256 integrity
│   ├── STREAMING.md         # FFmpeg video transcoding and adaptive HLS pipeline
│   ├── SECURITY.md          # Authentication, Argon2, JWT/refresh tokens, encrypted credentials
│   ├── DEPLOYMENT.md        # Deployment instructions, Docker Compose, environment setup
│   ├── TESTING.md           # Automated test suite and end-to-end verification matrix
│   └── COST-MANAGEMENT.md   # Cloudflare R2 pricing model, free-tier optimization, budget alerts
├── .env.example             # Complete environment configuration template
└── package.json             # Root monorepo configuration (npm workspaces)
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 20+ (tested on Node 26)
- Docker & Docker Compose (optional for containerized deployment)

### 2. Install & Build Monorepo
```bash
# Clone the repository
git clone <repo-url>
cd R2

# Install dependencies across all workspaces
npm install

# Build all TypeScript packages and applications
npm run build -w packages/common
npm run build -w packages/storage-engine
npm run build -w apps/backend
```

### 3. Run Automated Tests
```bash
# Run Storage Engine tests (8 GB quota, alerts, multi-bucket chunking, Range gateway)
npm run test -w packages/storage-engine

# Run Backend API integration tests (Auth, Netflix, YouTube, Instagram, Admin)
npm run test -w apps/backend
```

### 4. Start the Services
```bash
# Start backend API (Port 4000)
npm run start -w apps/backend

# Start responsive web application (Port 3000)
npm run dev -w apps/web

# Start web admin dashboard (Port 3001)
npm run dev -w apps/admin
```

---

## 🚢 Docker Deployment

Deploy the entire platform with PostgreSQL and Redis using a single command:
```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up -d --build
```

---

## 📚 Complete Architectural Documentation
- [System Architecture Specification](docs/ARCHITECTURE.md)
- [Database Architecture & Schema DDL](docs/DATABASE.md)
- [Multi-Account R2 Storage Architecture](docs/STORAGE.md)
- [Large-File Resumable Uploads](docs/UPLOADS.md)
- [Adaptive HLS Streaming Pipeline](docs/STREAMING.md)
- [Security, RBAC & Secret Isolation](docs/SECURITY.md)
- [Deployment & Operations Manual](docs/DEPLOYMENT.md)
- [Verification & Automated Test Suite](docs/TESTING.md)
- [Cost Management & Free-Tier Optimization](docs/COST-MANAGEMENT.md)
