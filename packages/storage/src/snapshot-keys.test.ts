import { describe, expect, it } from "vitest";
import { archiveObjectKey, fileObjectKey, manifestObjectKey, repositoryPrefix, snapshotPrefix } from "./snapshot-keys";

const REPO_ID = "123e4567-e89b-12d3-a456-426614174000";
const SNAPSHOT_ID = "123e4567-e89b-12d3-a456-426614174001";
const FILE_ID = "123e4567-e89b-12d3-a456-426614174002";

describe("snapshot object keys", () => {
  it("builds the archive key", () => {
    expect(archiveObjectKey(REPO_ID, SNAPSHOT_ID)).toBe(`${REPO_ID}/${SNAPSHOT_ID}/archive.tar.gz`);
  });

  it("builds the manifest key", () => {
    expect(manifestObjectKey(REPO_ID, SNAPSHOT_ID)).toBe(`${REPO_ID}/${SNAPSHOT_ID}/manifest.json`);
  });

  it("builds a per-file object key", () => {
    expect(fileObjectKey(REPO_ID, SNAPSHOT_ID, FILE_ID)).toBe(`${REPO_ID}/${SNAPSHOT_ID}/files/${FILE_ID}`);
  });

  it("builds a repository-wide prefix", () => {
    expect(repositoryPrefix(REPO_ID)).toBe(`${REPO_ID}/`);
  });

  it("builds a snapshot-wide prefix", () => {
    expect(snapshotPrefix(REPO_ID, SNAPSHOT_ID)).toBe(`${REPO_ID}/${SNAPSHOT_ID}/`);
  });
});
