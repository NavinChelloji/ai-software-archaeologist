import { S3Client } from "@aws-sdk/client-s3";

export type { S3Client } from "@aws-sdk/client-s3";

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO (LOCAL_SETUP.md) needs path-style URLs; real S3 does not. */
  forcePathStyle: boolean;
}

export function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
