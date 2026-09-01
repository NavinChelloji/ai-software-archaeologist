/**
 * The one object-storage layout every consumer agrees on
 * (GITHUB_CONNECTOR_SERVICE_PLAN.md "Object Storage Layout",
 * REPOSITORY_PROCESSOR_SERVICE_PLAN.md "File Content Storage"):
 *
 *   {repoId}/{snapshotId}/archive.tar.gz
 *   {repoId}/{snapshotId}/manifest.json
 *   {repoId}/{snapshotId}/files/{fileId}
 *
 * Centralized here (not duplicated as string templates in the Snapshots and
 * Parser modules) since both write into this layout and `ai` later reads
 * from it — one place to change if the layout ever does.
 */
export function archiveObjectKey(repoId: string, snapshotId: string): string {
  return `${repoId}/${snapshotId}/archive.tar.gz`;
}

export function manifestObjectKey(repoId: string, snapshotId: string): string {
  return `${repoId}/${snapshotId}/manifest.json`;
}

export function fileObjectKey(repoId: string, snapshotId: string, fileId: string): string {
  return `${repoId}/${snapshotId}/files/${fileId}`;
}

/** Everything belonging to one repository (DATA_RETENTION_AND_PRIVACY.md "indexer deletes the S3 prefix `{repoId}/`"). */
export function repositoryPrefix(repoId: string): string {
  return `${repoId}/`;
}

/** Everything belonging to one snapshot — used by `snapshot.prune` to remove a superseded snapshot's archive, manifest, and per-file objects in one deletion. */
export function snapshotPrefix(repoId: string, snapshotId: string): string {
  return `${repoId}/${snapshotId}/`;
}
