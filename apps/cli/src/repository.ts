import { constants } from 'node:fs';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import {
  AnalysisError,
  CONFIG_PATH,
  fileKind,
  LIMITS,
  parseSnapshot,
  type Profile,
  type RepositoryFile,
  type RepositorySnapshot
} from '@blackoutsecure/linuxserver-mcp/core';

export async function readBoundedFile(
  path: string,
  limit: number
): Promise<string> {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'Refusing to read a symlink or non-regular file.'
    );
  }
  if (info.size > limit)
    throw new AnalysisError(
      'RESOURCE_LIMIT',
      'A selected file exceeds its byte limit.'
    );
  const handle = await open(
    path,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit)
      throw new AnalysisError(
        'RESOURCE_LIMIT',
        'A selected file changed or exceeds its byte limit.'
      );
    const buffer = Buffer.alloc(limit + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > limit)
      throw new AnalysisError(
        'RESOURCE_LIMIT',
        'A selected file exceeds its byte limit.'
      );
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(
        buffer.subarray(0, offset)
      );
    } catch {
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'A selected source file is not UTF-8 text.'
      );
    }
  } finally {
    await handle.close();
  }
}

export function isWithin(root: string, path: string): boolean {
  const child = relative(root, path);
  return (
    child !== '..' &&
    !child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
    !isAbsolute(child)
  );
}

const relevantDirectory = (path: string) =>
  path === '.github' ||
  [
    'root',
    'root/etc',
    'root/etc/s6-overlay',
    'root/etc/s6-overlay/s6-rc.d'
  ].includes(path) ||
  path.startsWith('root/etc/s6-overlay/s6-rc.d/');

export async function loadRepository(
  directory: string,
  options: { changedFiles?: string[]; profile?: Profile } = {}
): Promise<RepositorySnapshot> {
  const root = await realpath(resolve(directory));
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory())
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'The audit target must be a repository directory.'
    );
  const files: RepositoryFile[] = [];
  let entries = 0;
  let bytes = 0;
  const deadline = Date.now() + 15_000;
  const visit = async (
    path: string,
    prefix: string,
    depth: number
  ): Promise<void> => {
    if (depth > LIMITS.depth)
      throw new AnalysisError(
        'RESOURCE_LIMIT',
        'Repository traversal exceeds the depth limit.'
      );
    const directory = await opendir(path);
    for await (const entry of directory) {
      if (++entries > LIMITS.traversedEntries || Date.now() > deadline) {
        throw new AnalysisError(
          'RESOURCE_LIMIT',
          'Repository traversal exceeds its entry or time limit.'
        );
      }
      const logical = prefix ? `${prefix}/${entry.name}` : entry.name;
      const selected = fileKind(logical) !== null;
      const descend = relevantDirectory(logical);
      if (!selected && !descend) continue;
      const absolute = resolve(path, entry.name);
      if (entry.isSymbolicLink()) {
        throw new AnalysisError(
          'VALIDATION_FAILED',
          'A relevant repository path is a symlink. Replace it with an explicit regular source file before auditing.'
        );
      }
      const canonical = await realpath(absolute);
      if (!isWithin(root, canonical))
        throw new AnalysisError(
          'VALIDATION_FAILED',
          'A selected path escapes the repository.'
        );
      if (entry.isDirectory()) {
        if (descend) await visit(canonical, logical, depth + 1);
      } else if (selected) {
        if (!entry.isFile())
          throw new AnalysisError(
            'VALIDATION_FAILED',
            'A selected source is not a regular file.'
          );
        if (files.length >= LIMITS.files)
          throw new AnalysisError(
            'RESOURCE_LIMIT',
            'The repository has too many selected source files.'
          );
        const content = await readBoundedFile(canonical, LIMITS.fileBytes);
        bytes += Buffer.byteLength(content);
        if (bytes > LIMITS.totalBytes)
          throw new AnalysisError(
            'RESOURCE_LIMIT',
            'Selected repository content exceeds the total byte limit.'
          );
        files.push({ path: logical, content });
      }
    }
  };
  await visit(root, '', 0);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return parseSnapshot({ files, complete: true, ...options });
}

export { CONFIG_PATH };
