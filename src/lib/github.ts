// One commit per publish through the Git Data API (blobs → tree → commit → ref).
// The Contents API commits one file at a time; a photo post is several files.

import type { FileEntry } from './micropub';

export interface GitHubEnv {
  token: string;
  repo: string; // owner/name
  branch: string;
}

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function gh<T>(env: GitHubEnv, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'by.erikov.me-micropub',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GitHubError(res.status, `GitHub ${init.method ?? 'GET'} ${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function toBase64(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Slugs of the posts already on the branch (file names without `.mdoc`). */
export async function listPostSlugs(env: GitHubEnv): Promise<string[]> {
  try {
    const items = await gh<{ name: string }[]>(
      env,
      `/repos/${env.repo}/contents/src/content/posts?ref=${encodeURIComponent(env.branch)}`,
    );
    return items.filter((i) => i.name.endsWith('.mdoc')).map((i) => i.name.replace(/\.mdoc$/, ''));
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return [];
    throw e;
  }
}

/** Commit `files` to the branch in one commit; returns the commit sha. */
export async function commitFiles(env: GitHubEnv, files: FileEntry[], message: string): Promise<string> {
  const ref = await gh<{ object: { sha: string } }>(env, `/repos/${env.repo}/git/ref/heads/${env.branch}`);
  const head = ref.object.sha;
  const headCommit = await gh<{ tree: { sha: string } }>(env, `/repos/${env.repo}/git/commits/${head}`);

  const tree = [];
  for (const f of files) {
    const blob = await gh<{ sha: string }>(env, `/repos/${env.repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: toBase64(f.content), encoding: 'base64' }),
    });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const newTree = await gh<{ sha: string }>(env, `/repos/${env.repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
  });
  const commit = await gh<{ sha: string }>(env, `/repos/${env.repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }),
  });
  await gh(env, `/repos/${env.repo}/git/refs/heads/${env.branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });
  return commit.sha;
}
