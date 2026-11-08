import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * S3-compatible object storage (AWS S3 in production, SeaweedFS locally).
 * Two clients: `client` talks to the internal endpoint; `signer` only signs URLs
 * against the endpoint the browser can reach (they differ inside Docker).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly signer: S3Client;
  private readonly createBucket: boolean;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const base = {
      // Newer SDKs attach CRC32 checksums by default, which many S3-compatible stores reject.
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
      region: config.get<string>('S3_REGION') || 'us-east-1',
      forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    };
    const endpoint = config.get<string>('S3_ENDPOINT') || undefined;
    this.client = new S3Client({ ...base, endpoint });
    this.signer = new S3Client({ ...base, endpoint: config.get<string>('S3_PUBLIC_ENDPOINT') || endpoint });
    this.createBucket = config.get<string>('S3_CREATE_BUCKET') === 'true';
  }

  /** Local development only: create the bucket if it does not exist yet. Provision it yourself in production. */
  async onModuleInit() {
    if (!this.createBucket) return;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        return;
      } catch {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          return;
        } catch {
          await sleep(1500); // storage container may still be starting
        }
      }
    }
    this.logger.warn(`Could not verify or create bucket "${this.bucket}"; uploads will fail until it exists`);
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deleteMany(keys: string[]) {
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  /** Short-lived link that always downloads (never renders inline), whatever the stored content type. */
  downloadUrl(key: string, fileName: string): Promise<string> {
    const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: 'application/octet-stream',
        ResponseContentDisposition: `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      }),
      { expiresIn: 300 },
    );
  }
}
