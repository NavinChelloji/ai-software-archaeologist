import type { Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { getObjectStream, putObject } from "./object-storage";

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
