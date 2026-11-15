import { Readable, PassThrough } from 'stream';
import { IFileManifest, IFileChunkManifest } from '@platform/common';
import { IStorageProvider } from '../interfaces/storage-provider.interface';

export interface ParsedByteRange {
  start: number;
  end: number;
}

export interface RangeStreamResponse {
  statusCode: number; // 200 or 206
  headers: Record<string, string | number>;
  stream: Readable;
}

export class RangeNotSatisfiableError extends Error {
  public readonly totalSizeBytes: number;
  constructor(totalSizeBytes: number) {
    super(`Requested range not satisfiable for file size ${totalSizeBytes}`);
    this.name = 'RangeNotSatisfiableError';
    this.totalSizeBytes = totalSizeBytes;
  }
}

export class RangeDownloadGateway {
  constructor(
    private readonly getProviderForAccount: (accountId: string) => IStorageProvider
  ) {}

  /**
   * Parse the HTTP `Range` header (e.g. "bytes=0-1048575", "bytes=5242880-")
   * Throws RangeNotSatisfiableError if range is out of bounds.
   */
  public parseRangeHeader(
    rangeHeader: string | undefined,
    totalSizeBytes: number
  ): ParsedByteRange | null {
    if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
      return null;
    }

    const matches = rangeHeader.replace('bytes=', '').trim().split('-');
    if (matches.length !== 2) {
      throw new RangeNotSatisfiableError(totalSizeBytes);
    }

    let start = matches[0] !== '' ? parseInt(matches[0], 10) : undefined;
    let end = matches[1] !== '' ? parseInt(matches[1], 10) : undefined;

    if (start === undefined && end !== undefined) {
      // Suffix range (e.g. -500: last 500 bytes)
      start = Math.max(0, totalSizeBytes - end);
      end = totalSizeBytes - 1;
    } else if (start !== undefined && end === undefined) {
      // Open-ended range (e.g. 500-)
      end = totalSizeBytes - 1;
    }

    if (
      start === undefined ||
      end === undefined ||
      isNaN(start) ||
      isNaN(end) ||
      start > end ||
      start >= totalSizeBytes ||
      start < 0
    ) {
      throw new RangeNotSatisfiableError(totalSizeBytes);
    }

    // Cap end at totalSizeBytes - 1
    end = Math.min(end, totalSizeBytes - 1);

    return { start, end };
  }

  /**
   * Handles HTTP HEAD request for a distributed file manifest without streaming any byte chunks.
   */
  public handleHeadRequest(manifest: IFileManifest): RangeStreamResponse {
    const headers: Record<string, string | number> = {
      'Content-Type': manifest.mimeType || 'application/octet-stream',
      'Content-Length': manifest.totalSizeBytes,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      ETag: manifest.totalSha256Checksum ? `"${manifest.totalSha256Checksum}"` : `"${manifest.id}"`
    };

    const emptyStream = new PassThrough();
    emptyStream.end();

    return {
      statusCode: 200,
      headers,
      stream: emptyStream
    };
  }

  /**
   * Creates a streaming HTTP response that seamlessly reads across multiple chunks
   * and buckets without buffering the entire file into server memory.
   */
  public async handleDownloadRequest(
    manifest: IFileManifest,
    rangeHeader?: string
  ): Promise<RangeStreamResponse> {
    if (!manifest.chunks || manifest.chunks.length === 0) {
      throw new Error(`File manifest ${manifest.id} has no chunks.`);
    }

    // Sort chunks strictly by chunkIndex to preserve byte order
    const sortedChunks = [...manifest.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    let parsedRange: ParsedByteRange | null = null;
    try {
      parsedRange = this.parseRangeHeader(rangeHeader, manifest.totalSizeBytes);
    } catch (err) {
      if (err instanceof RangeNotSatisfiableError) {
        const emptyStream = new PassThrough();
        emptyStream.end();
        return {
          statusCode: 416, // Range Not Satisfiable
          headers: {
            'Content-Range': `bytes */${manifest.totalSizeBytes}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': 0
          },
          stream: emptyStream
        };
      }
      throw err;
    }

    let startOffset: number;
    let endOffset: number;
    let isPartial = false;

    if (parsedRange) {
      startOffset = parsedRange.start;
      endOffset = parsedRange.end;
      isPartial = true;
    } else {
      startOffset = 0;
      endOffset = manifest.totalSizeBytes - 1;
      isPartial = false;
    }

    const contentLength = endOffset - startOffset + 1;

    // Identify affected chunks and their relative byte offsets
    const affectedSlices: {
      chunk: IFileChunkManifest;
      relativeStart: number;
      relativeEnd: number;
    }[] = [];

    for (const chunk of sortedChunks) {
      if (chunk.byteEnd >= startOffset && chunk.byteStart <= endOffset) {
        const sliceStart = Math.max(0, startOffset - chunk.byteStart);
        const sliceEnd = Math.min(chunk.chunkSizeBytes - 1, endOffset - chunk.byteStart);

        affectedSlices.push({
          chunk,
          relativeStart: sliceStart,
          relativeEnd: sliceEnd
        });
      }
    }

    if (affectedSlices.length === 0) {
      throw new Error('Requested byte range could not be mapped to any available chunk.');
    }

    // High-performance bounded streaming pipeline with 1MB highWaterMark buffer for instant playback
    const outputStream = new PassThrough({ highWaterMark: 1024 * 1024 });

    // Stream sequentially in background without holding entire file in RAM
    (async () => {
      try {
        for (const slice of affectedSlices) {
          const provider = this.getProviderForAccount(slice.chunk.storageAccountId);
          const chunkResult = await provider.getObject(
            slice.chunk.bucketName,
            slice.chunk.objectKey,
            { start: slice.relativeStart, end: slice.relativeEnd }
          );

          await new Promise<void>((resolve, reject) => {
            chunkResult.stream.on('error', (err) => reject(err));
            chunkResult.stream.on('end', () => resolve());
            chunkResult.stream.pipe(outputStream, { end: false });
          });
        }
        outputStream.end();
      } catch (streamError) {
        outputStream.destroy(streamError as Error);
      }
    })();

    const headers: Record<string, string | number> = {
      'Content-Type': manifest.mimeType || 'application/octet-stream',
      'Content-Length': contentLength,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: manifest.totalSha256Checksum ? `"${manifest.totalSha256Checksum}"` : `"${manifest.id}"`
    };

    if (isPartial) {
      headers['Content-Range'] = `bytes ${startOffset}-${endOffset}/${manifest.totalSizeBytes}`;
      return {
        statusCode: 206, // Partial Content
        headers,
        stream: outputStream
      };
    }

    return {
      statusCode: 200, // OK
      headers,
      stream: outputStream
    };
  }
}
