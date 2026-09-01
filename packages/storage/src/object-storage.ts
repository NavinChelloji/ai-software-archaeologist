import type { Readable } from "node:stream";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

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

/** The S3 DeleteObjects API accepts at most 1000 keys per request. */
const DELETE_BATCH_SIZE = 1000;

/** Deletes a single object. A missing object is not an error (DATA_RETENTION_AND_PRIVACY.md deletion steps are idempotent and retried on failure). */
export async function deleteObject(client: S3Client, bucket: string, key: string): Promise<void> {
  await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: key }], Quiet: true } }));
}

/**
 * Lists and deletes every object under `prefix` (DATA_RETENTION_AND_PRIVACY.md
 * "indexer deletes the S3 prefix `{repoId}/`" and snapshot pruning's
 * `{repoId}/{snapshotId}/` prefix). Idempotent — deleting an empty or
 * already-gone prefix is a no-op, not an error, so retries are always safe.
 */
export async function deleteObjectsByPrefix(client: S3Client, bucket: string, prefix: string): Promise<number> {
  let deletedCount = 0;
  let continuationToken: string | undefined;

  do {
    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    const keys = (listed.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : []));

    for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
      const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
      await client.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } })
      );
      deletedCount += batch.length;
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return deletedCount;
}
