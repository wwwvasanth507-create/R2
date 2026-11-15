/**
 * Storage & Quota Constants
 * 
 * NOTE: Strictly defined in binary units (GiB / MiB):
 * 1 GiB = 1,024 * 1,024 * 1,024 bytes = 1,073,741,824 bytes
 * 1 MiB = 1,024 * 1,024 bytes = 1,048,576 bytes
 * 
 * 8 GiB Logical Quota per bucket = 8,589,934,592 bytes
 * 256 MiB Chunk Size = 268,435,456 bytes
 */

export const BYTES_PER_MIB = 1024 * 1024;
export const BYTES_PER_GIB = 1024 * 1024 * 1024;

export const DEFAULT_LOGICAL_QUOTA_BYTES = 8 * BYTES_PER_GIB; // 8 GiB = 8,589,934,592 bytes
export const DEFAULT_CHUNK_SIZE_BYTES = 256 * BYTES_PER_MIB;  // 256 MiB = 268,435,456 bytes

export const ALERT_THRESHOLD_70 = 0.70;
export const ALERT_THRESHOLD_85 = 0.85;
export const ALERT_THRESHOLD_100 = 1.00;

export const PRESIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour for large chunk uploads
export const STREAM_PRESIGNED_EXPIRY_SECONDS = 7200; // 2 hours for video playback tokens

// Cloudflare R2 standard Free Tier benchmarks (tracked for cost estimation)
export const R2_FREE_STORAGE_BYTES = 10 * BYTES_PER_GIB; // 10 GB/month
export const R2_FREE_CLASS_A_OPS = 1_000_000;            // 1M Class A operations/month (creates, lists)
export const R2_FREE_CLASS_B_OPS = 10_000_000;           // 10M Class B operations/month (reads)
export const R2_EGRESS_COST_PER_GB = 0.00;               // Free egress on Cloudflare R2!

// Paid rates beyond free tier
export const R2_STORAGE_COST_PER_GB = 0.015;             // $0.015 per GB-month
export const R2_CLASS_A_PER_MILLION = 4.50;              // $4.50 per million
export const R2_CLASS_B_PER_MILLION = 0.36;              // $0.36 per million
