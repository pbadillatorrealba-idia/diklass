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

export type ProvisionArgs = { fixturePath: string; allowRemote: boolean };

const DEFAULT_FIXTURE_PATH = "tests/fixtures/veterinarians.json";

/**
 * Single, cursor-based pass over argv. A value consumed as --fixture's argument is
 * advanced past and never re-inspected as a flag, so `--fixture --allow-remote` cannot
 * silently swallow --allow-remote as a filename while still counting it as the flag
 * (the previous two-independent-scans bug: `args.includes("--allow-remote")` matched
 * anywhere in argv regardless of position).
 */
export function parseArgs(args: string[]): ProvisionArgs {
  let fixturePath: string | undefined;
  let allowRemote = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--fixture") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Falta la ruta de --fixture (o su valor es otro flag).");
      }
      fixturePath = value;
      index += 1; // consume the value so it can never be re-read as a flag
    } else if (arg === "--allow-remote") {
      allowRemote = true;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return { fixturePath: fixturePath ?? DEFAULT_FIXTURE_PATH, allowRemote };
}
