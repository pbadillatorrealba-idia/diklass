const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "host.docker.internal"]);

/** Synthetic accounts with known passwords must never reach a real project by accident. */
export function isLocalSupabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type AuthUserPage = { users: { id: string; email?: string | null }[] };

/** Auth compares emails case-insensitively and paginates users; so does this lookup. */
export async function findUserIdByEmail(
  listPage: (page: number) => Promise<AuthUserPage>,
  email: string,
  perPage: number,
): Promise<string | undefined> {
  const target = normalizeEmail(email);
  for (let page = 1; ; page += 1) {
    const { users } = await listPage(page);
    const match = users.find((user) => user.email && normalizeEmail(user.email) === target);
    if (match) {
      return match.id;
    }
    if (users.length < perPage) {
      return undefined;
    }
  }
}
