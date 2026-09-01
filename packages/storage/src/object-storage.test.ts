import type { Readable } from "node:stream";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { deleteObject, deleteObjectsByPrefix, getObjectStream, putObject } from "./object-storage";

describe("putObject", () => {
  it("sends a PutObjectCommand with the given bucket, key, and body", async () => {
    const send = vi.fn().mockResolvedValue({});
    const client = { send } as unknown as S3Client;

    await putObject(client, { bucket: "aca-snapshots", key: "repo/snap/archive.tar.gz", body: Buffer.from("x") });

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]![0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({ Bucket: "aca-snapshots", Key: "repo/snap/archive.tar.gz" });
  });
});

describe("getObjectStream", () => {
  it("returns the response body stream", async () => {
    const body = {} as Readable;
    const send = vi.fn().mockResolvedValue({ Body: body });
    const client = { send } as unknown as S3Client;

    const result = await getObjectStream(client, "aca-snapshots", "repo/snap/archive.tar.gz");

    expect(result).toBe(body);
    const command = send.mock.calls[0]![0] as GetObjectCommand;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toMatchObject({ Bucket: "aca-snapshots", Key: "repo/snap/archive.tar.gz" });
  });

  it("throws when the response has no body", async () => {
    const send = vi.fn().mockResolvedValue({ Body: undefined });
    const client = { send } as unknown as S3Client;

    await expect(getObjectStream(client, "aca-snapshots", "missing/key")).rejects.toThrow();
  });
});

describe("deleteObject", () => {
  it("sends a DeleteObjectsCommand for the single key", async () => {
    const send = vi.fn().mockResolvedValue({});
    const client = { send } as unknown as S3Client;

    await deleteObject(client, "aca-snapshots", "repo/snap/archive.tar.gz");

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]![0] as DeleteObjectsCommand;
    expect(command).toBeInstanceOf(DeleteObjectsCommand);
    expect(command.input).toMatchObject({
      Bucket: "aca-snapshots",
      Delete: { Objects: [{ Key: "repo/snap/archive.tar.gz" }], Quiet: true },
    });
  });
});

describe("deleteObjectsByPrefix", () => {
  it("does nothing and returns 0 when the prefix has no objects", async () => {
    const send = vi.fn().mockResolvedValue({ Contents: [], IsTruncated: false });
    const client = { send } as unknown as S3Client;

    const deleted = await deleteObjectsByPrefix(client, "aca-snapshots", "repo-1/");

    expect(deleted).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toBeInstanceOf(ListObjectsV2Command);
  });

  it("lists and deletes every object under the prefix", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Contents: [{ Key: "repo-1/snap-1/archive.tar.gz" }, { Key: "repo-1/snap-1/manifest.json" }], IsTruncated: false });
    const client = { send } as unknown as S3Client;

    const deleted = await deleteObjectsByPrefix(client, "aca-snapshots", "repo-1/snap-1/");

    expect(deleted).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    const listCommand = send.mock.calls[0]![0] as ListObjectsV2Command;
    expect(listCommand.input).toMatchObject({ Bucket: "aca-snapshots", Prefix: "repo-1/snap-1/" });
    const deleteCommand = send.mock.calls[1]![0] as DeleteObjectsCommand;
    expect(deleteCommand.input.Delete?.Objects).toEqual([
      { Key: "repo-1/snap-1/archive.tar.gz" },
      { Key: "repo-1/snap-1/manifest.json" },
    ]);
  });

  it("follows pagination via ContinuationToken across multiple list pages", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Contents: [{ Key: "repo-1/a" }], IsTruncated: true, NextContinuationToken: "page-2" })
      .mockResolvedValueOnce({}) // delete for page 1
      .mockResolvedValueOnce({ Contents: [{ Key: "repo-1/b" }], IsTruncated: false })
      .mockResolvedValueOnce({}); // delete for page 2
    const client = { send } as unknown as S3Client;

    const deleted = await deleteObjectsByPrefix(client, "aca-snapshots", "repo-1/");

    expect(deleted).toBe(2);
    expect(send).toHaveBeenCalledTimes(4);
    const secondList = send.mock.calls[2]![0] as ListObjectsV2Command;
    expect(secondList.input.ContinuationToken).toBe("page-2");
  });
});
