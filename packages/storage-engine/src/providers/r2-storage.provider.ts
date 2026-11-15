import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import {
  IStorageProvider,
  ObjectMetadata,
  GetObjectResult
} from '../interfaces/storage-provider.interface';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  region?: string;
}

export class R2StorageProvider implements IStorageProvider {
  private client: S3Client;
  public readonly accountId: string;

  constructor(config: R2Config) {
    this.accountId = config.accountId;
    const endpoint = config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`;
    const region = config.region || 'auto';

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED'
    } as any);
  }

  async generatePresignedUploadUrl(
    bucketName: string,
    objectKey: string,
    expiresInSeconds: number,
    contentType?: string
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType || 'application/octet-stream'
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async generatePresignedDownloadUrl(
    bucketName: string,
    objectKey: string,
    expiresInSeconds: number
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async putObject(
    bucketName: string,
    objectKey: string,
    body: Buffer | Uint8Array | Readable | string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<{ etag?: string }> {
    let finalBody: any = body;
    let contentLength: number | undefined;

    if (metadata) {
      const rawLen = metadata.contentLength || (metadata as any)['content-length'];
      if (rawLen !== undefined && rawLen !== null && rawLen !== '') {
        const parsed = Number(rawLen);
        if (!isNaN(parsed) && parsed >= 0) {
          contentLength = parsed;
        }
      }
    }

    if (contentLength === undefined) {
      if (Buffer.isBuffer(body)) {
        contentLength = body.length;
      } else if (typeof body === 'string') {
        contentLength = Buffer.byteLength(body);
      } else if (body instanceof Uint8Array) {
        contentLength = body.byteLength;
      }
    }

    // If body is a stream and contentLength is still unknown, buffer it so ContentLength is guaranteed
    if (contentLength === undefined && body && typeof (body as any).pipe === 'function') {
      const chunks: Buffer[] = [];
      for await (const chunk of (body as any)) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      finalBody = Buffer.concat(chunks);
      contentLength = finalBody.length;
    }

    // Sanitize metadata to avoid invalid S3 header values and remove internal contentLength
    let sanitizedMetadata: Record<string, string> | undefined = undefined;
    if (metadata) {
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(metadata)) {
        if (
          v !== undefined &&
          v !== null &&
          k !== 'contentLength' &&
          k !== 'content-length'
        ) {
          filtered[k] = String(v);
        }
      }
      if (Object.keys(filtered).length > 0) {
        sanitizedMetadata = filtered;
      }
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: finalBody,
      ContentType: contentType,
      ContentLength: contentLength,
      Metadata: sanitizedMetadata
    });

    const res = await this.client.send(command);
    return { etag: res.ETag };
  }

  async getObject(
    bucketName: string,
    objectKey: string,
    range?: { start: number; end: number }
  ): Promise<GetObjectResult> {
    const rangeHeader = range !== undefined ? `bytes=${range.start}-${range.end}` : undefined;
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Range: rangeHeader
    });

    const res = await this.client.send(command);
    const stream = res.Body as Readable;

    return {
      stream,
      contentLength: res.ContentLength || 0,
      contentType: res.ContentType || 'application/octet-stream',
      contentRange: res.ContentRange,
      etag: res.ETag,
      lastModified: res.LastModified
    };
  }

  async getObjectMetadata(
    bucketName: string,
    objectKey: string
  ): Promise<ObjectMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: objectKey
      });

      const res = await this.client.send(command);
      return {
        contentLength: res.ContentLength || 0,
        contentType: res.ContentType || 'application/octet-stream',
        etag: res.ETag,
        lastModified: res.LastModified,
        metadata: res.Metadata
      };
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async deleteObject(bucketName: string, objectKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey
    });

    await this.client.send(command);
  }

  async checkBucketHealth(bucketName: string): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({ Bucket: bucketName });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getBucketUsage(bucketName: string): Promise<{ objectCount: number; totalSizeBytes: number }> {
    try {
      let continuationToken: string | undefined = undefined;
      let totalBytes = 0;
      let count = 0;
      do {
        const command: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken
        });
        const res = await this.client.send(command);
        if (res.Contents) {
          for (const item of res.Contents) {
            totalBytes += item.Size || 0;
            count++;
          }
        }
        continuationToken = res.NextContinuationToken;
      } while (continuationToken);

      return { objectCount: count, totalSizeBytes: totalBytes };
    } catch (err: any) {
      console.warn(`[R2StorageProvider] getBucketUsage notice for ${bucketName}:`, err.message);
      return { objectCount: 0, totalSizeBytes: 0 };
    }
  }
}
