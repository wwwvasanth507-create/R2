import { Readable } from 'stream';

export interface ObjectMetadata {
  contentLength: number;
  contentType: string;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface GetObjectResult {
  stream: Readable;
  contentLength: number;
  contentType: string;
  contentRange?: string;
  etag?: string;
  lastModified?: Date;
}

export interface IStorageProvider {
  /**
   * Generates a presigned URL allowing client-direct PUT uploads without passing
   * through the backend server.
   */
  generatePresignedUploadUrl(
    bucketName: string,
    objectKey: string,
    expiresInSeconds: number,
    contentType?: string
  ): Promise<string>;

  /**
   * Generates a presigned URL for secure read/streaming access.
   */
  generatePresignedDownloadUrl(
    bucketName: string,
    objectKey: string,
    expiresInSeconds: number
  ): Promise<string>;

  /**
   * Put an object directly into storage (used for manifests, HLS playlists, thumbnails)
   */
  putObject(
    bucketName: string,
    objectKey: string,
    body: Buffer | Uint8Array | Readable | string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<{ etag?: string }>;

  /**
   * Retrieve an object or byte range slice as a Readable stream
   */
  getObject(
    bucketName: string,
    objectKey: string,
    range?: { start: number; end: number }
  ): Promise<GetObjectResult>;

  /**
   * Inspect object metadata (e.g. content length, existence, ETag)
   */
  getObjectMetadata(
    bucketName: string,
    objectKey: string
  ): Promise<ObjectMetadata | null>;

  /**
   * Delete an object from storage
   */
  deleteObject(bucketName: string, objectKey: string): Promise<void>;

  /**
   * Verify connectivity and credentials against a specific bucket
   */
  checkBucketHealth(bucketName: string): Promise<boolean>;
}
