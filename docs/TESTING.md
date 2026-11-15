# Verification & Testing Guide

## 1. Automated Test Suite Overview
The platform includes automated unit, integration, and end-to-end verification suites covering:
- Dynamic 8 GB logical quota allocation and priority-based bucket spillover.
- Storage threshold alert evaluation (70%, 85%, 100%) and notification deduplication.
- Large-file chunk distribution (e.g. 20 GiB distributed across multiple buckets).
- HTTP Range scatter-gather virtual reassembly and partial content (HTTP 206) streaming.
- Checksum verification (SHA-256 integrity).
- Authentication, RBAC, and permission boundary security.

---

## 2. Running Automated Tests

```bash
# Run unit & integration tests for storage engine
npm run test -w packages/storage-engine

# Run backend API tests
npm run test -w apps/backend

# Run full monorepo test suite
npm run test
```

---

## 3. End-to-End Test Matrix & Acceptance Criteria

| ID | Test Scenario | Expected Outcome | Verification |
|---|---|---|---|
| **TC-01** | Upload file $\le 8\text{ GB}$ (e.g. 2 GB) | Allocated sequentially to Bucket 1; remains single-bucket | Verified in `packages/storage-engine/src/__tests__/storage-engine.test.ts` |
| **TC-02** | Upload file $> 8\text{ GB}$ (e.g. 20 GB) | Distributed across Bucket 1 (8 GB), Bucket 2 (8 GB), and Bucket 3 (4 GB) | Verified in `packages/storage-engine/src/__tests__/storage-engine.test.ts` |
| **TC-03** | 70% Alert Threshold | Bucket reaches 70% capacity; sends deduplicated warning email | Verified in `packages/storage-engine/src/__tests__/storage-engine.test.ts` |
| **TC-04** | 85% High Usage Warning | Bucket reaches 85% capacity; sends escalated high-usage alert | Verified in `packages/storage-engine/src/__tests__/storage-engine.test.ts` |
| **TC-05** | 100% Allocation Stop | Bucket reaches 100% logical quota; stops further allocation and spillovers to next bucket | Verified in `packages/storage-engine/src/__tests__/storage-engine.test.ts` |
| **TC-06** | Multi-Bucket HTTP Range Request | Client requests bytes crossing chunk boundary (e.g. byte 5-14 across 2 chunks); returns exact byte order | Verified in `packages/storage-engine/src/__tests__/storage-engine.test.ts` |
| **TC-07** | SHA-256 Stream Integrity | Validates byte chunks match expected hash; rejects corrupted bytes | Verified in `packages/storage-engine/src/__tests__/storage-engine.test.ts` |
