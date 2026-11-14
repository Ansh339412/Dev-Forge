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
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
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
  private readonly client?: S3Client;
  private readonly signer?: S3Client;
  private readonly createBucket: boolean;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('ATTACHMENTS_ENABLED') !== 'false';
    this.createBucket = config.get<string>('S3_CREATE_BUCKET') === 'true';
    if (!this.enabled) {
      this.bucket = '';
      return;
    }

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
  }

  /** Local development only: create the bucket if it does not exist yet. Provision it yourself in production. */
  async onModuleInit() {
    if (!this.enabled || !this.createBucket) return;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        await this.requireClient().send(new HeadBucketCommand({ Bucket: this.bucket }));
        return;
      } catch {
        try {
          await this.requireClient().send(new CreateBucketCommand({ Bucket: this.bucket }));
          return;
        } catch {
          await sleep(1500); // storage container may still be starting
        }
      }
    }
    this.logger.warn(`Could not verify or create bucket "${this.bucket}"; uploads will fail until it exists`);
  }

  ensureEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Attachments are disabled on this deployment');
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.requireClient().send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async delete(key: string) {
    if (!this.enabled) return;
    await this.requireClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deleteMany(keys: string[]) {
    if (!this.enabled) return;
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      await this.requireClient().send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  /** Short-lived link that always downloads (never renders inline), whatever the stored content type. */
  downloadUrl(key: string, fileName: string): Promise<string> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Attachments are disabled on this deployment');
    }
    const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return getSignedUrl(
      this.requireSigner(),
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: 'application/octet-stream',
        ResponseContentDisposition: `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      }),
      { expiresIn: 300 },
    );
  }

  private requireClient(): S3Client {
    this.ensureEnabled();
    if (!this.client) throw new ServiceUnavailableException('Attachment storage is not configured');
    return this.client;
  }

  private requireSigner(): S3Client {
    this.ensureEnabled();
    if (!this.signer) throw new ServiceUnavailableException('Attachment storage is not configured');
    return this.signer;
  }
}
