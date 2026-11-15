import * as crypto from 'crypto';
import { Readable } from 'stream';

export class ChecksumVerifier {
  /**
   * Computes SHA-256 checksum of a Readable stream with bounded memory.
   */
  public static async computeStreamSha256(stream: Readable): Promise<string> {
    const hash = crypto.createHash('sha256');
    return new Promise<string>((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Computes SHA-256 checksum of a Buffer.
   */
  public static computeBufferSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Verifies that the provided SHA-256 matches computed value.
   */
  public static verifyChecksum(expected: string, actual: string): boolean {
    return expected.toLowerCase() === actual.toLowerCase();
  }
}
