import type { Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

export interface PutObjectInput {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | Readable;
  contentType?: string;
  contentLength?: number;
}

/** Streams `body` to object storage — never re-buffers a copy of what the caller already has in a stream (RULES.md #9 "stream large files"). */
export async function putObject(client: S3Client, input: PutObjectInput): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    })
  );
}

/** Returns the object body as a readable stream. Callers pipe or async-iterate it — never buffer a whole archive or file object into memory. */
export async function getObjectStream(client: S3Client, bucket: string, key: string): Promise<Readable> {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!result.Body) {
    throw new Error(`Object storage returned no body for ${bucket}/${key}`);
  }
  return result.Body as Readable;
}
