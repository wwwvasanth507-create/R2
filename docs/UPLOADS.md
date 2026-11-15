# Large File Upload Architecture: Distributed Chunking & Resumability

## 1. Problem Statement & Design Objectives
Modern high-fidelity media uploads (such as 4K HDR movies, long-form podcast recordings, and raw archival footage) range from 500 MB to 20 GB or more. Given our application-enforced **8 GB logical bucket quota**, files larger than 8 GB cannot fit into a single bucket.

The upload subsystem addresses this with:
1. **Zero Server Memory Bottlenecks**: High-bandwidth binary streams bypass the application server and upload directly from Flutter/Web clients to Cloudflare R2 using presigned URLs.
2. **Distributed Bucket Spilling**: An arbitrary-sized file is partitioned into deterministic chunks and distributed across multiple buckets and accounts.
3. **Resilience & Resumability**: Network drops or interruptions at 18 GB of a 20 GB upload only require retrying unverified chunks, not restarting the entire upload.
4. **Data Integrity**: Every chunk and whole file is validated with SHA-256 checksums before entering the processing pipeline.

---

## 2. Distributed Chunking Topology (20 GiB File Example)

```mermaid
flowchart TD
    subgraph Client["Client Uploader (Web / Flutter)"]
        FILE["Original File: 20 GiB (80 Chunks @ 256 MiB)"]
    end

    subgraph Backend["Backend API"]
        SESSION["1. Create Upload Session"]
        ALLOC["2. Dynamic Bucket Allocation"]
        PRESIGN["3. Issue 80 Presigned PUT URLs"]
        VERIFY["5. Verify Hashes & Finalize Manifest"]
    end

    subgraph Storage["Cloudflare R2 Buckets"]
        B1["Bucket A (8 GiB Cap)\nChunks 0 - 31 (8.0 GiB)"]
        B2["Bucket B (8 GiB Cap)\nChunks 32 - 63 (8.0 GiB)"]
        B3["Bucket C (8 GiB Cap)\nChunks 64 - 79 (4.0 GiB)"]
    end

    FILE --> SESSION
    SESSION --> ALLOC
    ALLOC --> PRESIGN
    PRESIGN --> FILE
    
    %% Direct parallel upload
    FILE ==>|"Direct PUT Chunks 0..31"| B1
    FILE ==>|"Direct PUT Chunks 32..63"| B2
    FILE ==>|"Direct PUT Chunks 64..79"| B3
    
    FILE -->|"4. Complete Chunk (SHA-256)"| VERIFY
```

---

## 3. Upload Lifecycle Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Web / Flutter)
    participant API as Backend API
    participant Engine as Storage Allocation Engine
    participant DB as PostgreSQL
    participant R2 as Cloudflare R2

    User->>API: POST /api/uploads/sessions (Filename, 20 GiB, SHA-256)
    API->>Engine: planDistribution(20 GiB, 256 MiB chunks)
    Engine->>DB: Check remaining capacity & reserve chunks (A, B, C)
    Engine->>R2: Generate Presigned PUT URLs for each chunk
    API-->>User: UploadSessionResponse (80 chunks, URLs, chunk indices)
    
    loop For each chunk (concurrent / configurable pool)
        User->>User: Read file slice [byteStart, byteEnd] & compute SHA-256
        User->>R2: HTTP PUT slice directly to Presigned URL
        R2-->>User: 200 OK (ETag)
        User->>API: POST /api/uploads/chunks/verify (fileId, chunkIndex, sha256)
        API->>DB: Update chunk status to VERIFIED, commit reservation
    end

    API->>DB: Check all 80 chunks VERIFIED
    API->>DB: Mark file status = READY
    API->>DB: Enqueue video transcoding job in BullMQ
    API-->>User: File Upload Successfully Completed!
```

---

## 4. Key Implementation Rules
- **Memory Bounding**: Chunk reads in the client are streamed directly into the upload request or read using bounded `Blob.slice()` / Dart `RandomAccessFile.setPositionSync()`.
- **Parallelism & Backpressure**: Clients enforce concurrency limits (default: 3 concurrent chunk uploads) with exponential backoff on HTTP 429 / 5xx errors.
- **Deduplication**: When resuming an interrupted session, the client queries `GET /api/uploads/sessions/:id/status` and only uploads chunks with status `PENDING` or `FAILED`.
