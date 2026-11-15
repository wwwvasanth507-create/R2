import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand
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
      }
    });
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
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: body as any,
      ContentType: contentType,
      Metadata: metadata
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
}
