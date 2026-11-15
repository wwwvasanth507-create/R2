import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import {
  IStorageProvider,
  ObjectMetadata,
  GetObjectResult
} from '../interfaces/storage-provider.interface';

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;
  public readonly accountId: string;

  constructor(baseDir?: string, accountId = 'local-account') {
    this.accountId = accountId;
    this.baseDir = baseDir || path.resolve(process.cwd(), '.local-storage', accountId);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getBucketPath(bucketName: string): string {
    const bucketPath = path.join(this.baseDir, bucketName);
    if (!fs.existsSync(bucketPath)) {
      fs.mkdirSync(bucketPath, { recursive: true });
    }
    return bucketPath;
  }

  private getObjectPath(bucketName: string, objectKey: string): string {
    const fullPath = path.join(this.getBucketPath(bucketName), objectKey);
    const parent = path.dirname(fullPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    return fullPath;
  }

  async generatePresignedUploadUrl(
    bucketName: string,
    objectKey: string,
    expiresInSeconds: number,
    _contentType?: string
  ): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return `/api/storage/mock-upload/${encodeURIComponent(bucketName)}/${encodeURIComponent(objectKey)}?exp=${exp}`;
  }

  async generatePresignedDownloadUrl(
    bucketName: string,
    objectKey: string,
    expiresInSeconds: number
  ): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return `/api/storage/mock-download/${encodeURIComponent(bucketName)}/${encodeURIComponent(objectKey)}?exp=${exp}`;
  }

  async putObject(
    bucketName: string,
    objectKey: string,
    body: Buffer | Uint8Array | Readable | string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<{ etag?: string }> {
    const targetPath = this.getObjectPath(bucketName, objectKey);

    if (body instanceof Readable) {
      const writeStream = fs.createWriteStream(targetPath);
      await new Promise<void>((resolve, reject) => {
        body.pipe(writeStream);
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (err) => reject(err));
      });
    } else {
      await fs.promises.writeFile(targetPath, body as any);
    }

    const metaPath = targetPath + '.meta.json';
    await fs.promises.writeFile(
      metaPath,
      JSON.stringify({
        contentType,
        metadata: metadata || {},
        updatedAt: new Date().toISOString()
      }),
      'utf-8'
    );

    return { etag: `w/"local-${Date.now()}"` };
  }

  async getObject(
    bucketName: string,
    objectKey: string,
    range?: { start: number; end: number }
  ): Promise<GetObjectResult> {
    const targetPath = this.getObjectPath(bucketName, objectKey);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Object not found: ${bucketName}/${objectKey}`);
    }

    const stat = await fs.promises.stat(targetPath);
    let meta = { contentType: 'application/octet-stream' };
    const metaPath = targetPath + '.meta.json';
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      } catch {
        // Fallback
      }
    }

    if (range) {
      const start = Math.max(0, range.start);
      const end = Math.min(stat.size - 1, range.end);
      const stream = fs.createReadStream(targetPath, { start, end });
      const contentLength = end - start + 1;
      return {
        stream,
        contentLength,
        contentType: meta.contentType,
        contentRange: `bytes ${start}-${end}/${stat.size}`,
        etag: `w/"local-${stat.mtimeMs}"`,
        lastModified: stat.mtime
      };
    }

    return {
      stream: fs.createReadStream(targetPath),
      contentLength: stat.size,
      contentType: meta.contentType,
      etag: `w/"local-${stat.mtimeMs}"`,
      lastModified: stat.mtime
    };
  }

  async getObjectMetadata(
    bucketName: string,
    objectKey: string
  ): Promise<ObjectMetadata | null> {
    const targetPath = this.getObjectPath(bucketName, objectKey);
    if (!fs.existsSync(targetPath)) {
      return null;
    }

    const stat = await fs.promises.stat(targetPath);
    let meta = { contentType: 'application/octet-stream', metadata: {} };
    const metaPath = targetPath + '.meta.json';
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      } catch {
        // Fallback
      }
    }

    return {
      contentLength: stat.size,
      contentType: meta.contentType,
      etag: `w/"local-${stat.mtimeMs}"`,
      lastModified: stat.mtime,
      metadata: meta.metadata
    };
  }

  async deleteObject(bucketName: string, objectKey: string): Promise<void> {
    const targetPath = this.getObjectPath(bucketName, objectKey);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
    const metaPath = targetPath + '.meta.json';
    if (fs.existsSync(metaPath)) {
      await fs.promises.unlink(metaPath);
    }
  }

  async checkBucketHealth(bucketName: string): Promise<boolean> {
    const bucketPath = path.join(this.baseDir, bucketName);
    return fs.existsSync(bucketPath);
  }
}
