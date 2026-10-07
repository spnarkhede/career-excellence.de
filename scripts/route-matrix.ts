import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Route-matrix discovery (Phase 10, checklist test 1: "A route matrix
 * generated from the codebase... Unclassified new routes fail the test").
 *
 * This is static-analysis-based (regex over controller/page source), not a
 * live HTTP crawl against 4 real personas — there is no live database or
 * running server in this environment (same limitation as every prior
 * phase), so a real anonymous/user/admin/wrong-role HTTP matrix isn't
 * executable here. What IS executable, and is the practical proxy this
 * implementation uses: discover every actual route/page in the codebase,
 * and verify its DECLARED guard configuration (whether a controller method
 * has `@UseGuards(SessionGuard, ...)` / `@RequirePermission(...)`, whether a
 * page calls `requireUser`/`requirePermission`) matches a hand-maintained
 * manifest. A route that exists in the code but not in the manifest fails
 * the test — exactly the "unclassified new routes fail" requirement — and a
 * route whose actual guards drifted from what the manifest expects also
 * fails, catching an accidentally-removed guard just as reliably as a
 * forgotten one on a brand new route.
 */

export interface ApiHandler {
  file: string;
  methodName: string;
  httpMethod: string | null;
  /** True if `SessionGuard` appears in either the class-level or
   * method-level `@UseGuards(...)` applicable to this handler. */
  hasSessionGuard: boolean;
  /** The permission name passed to `@RequirePermission(...)` on this
   * handler, if any. */
  requiredPermission: string | null;
}

const HTTP_METHODS = ["Get", "Post", "Put", "Patch", "Delete"];

function listFilesRecursive(dir: string, predicate: (name: string) => boolean): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listFilesRecursive(full, predicate));
    } else if (predicate(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Extracts every `@UseGuards(...)` argument list appearing in a source
 * file, keyed by whether it decorates the class (appears before the first
 * `export class`) or a specific method. Deliberately regex-based, not a
 * real TS parser — simple enough to keep this test maintainable without a
 * compiler dependency, and controller files in this codebase are written in
 * a consistent enough style for this to be reliable (verified against every
 * controller file as of this phase). */
export function discoverApiHandlers(controllersDir: string): ApiHandler[] {
  const files = listFilesRecursive(controllersDir, (name) => name.endsWith(".controller.ts"));
  const handlers: ApiHandler[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const classMatch = /export class \w+/.exec(source);
    const classStart = classMatch ? classMatch.index : source.length;
    const classGuardsBlock = source.slice(0, classStart);
    const classHasSessionGuard = /@UseGuards\([^)]*SessionGuard[^)]*\)/.test(classGuardsBlock);

    // Line-by-line state machine, not a block-splitting regex: accumulate
    // every decorator line (@Get/@UseGuards/@RequirePermission/...) seen
    // since the last method, then associate that accumulated set with the
    // next actual method-definition line encountered — a decorator and the
    // method it decorates are always adjacent lines in this codebase's
    // style, but splitting the TEXT between them (an earlier version of
    // this function did) silently separates a decorator from its method,
    // which is exactly backwards.
    let pendingDecorators = "";
    for (const rawLine of source.slice(classStart).split("\n")) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("@") || trimmed.startsWith("//")) {
        pendingDecorators += trimmed + "\n";
        continue;
      }

      const methodMatch =
        /^(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([a-zA-Z_]\w*)\s*\(/.exec(trimmed);
      if (!methodMatch) {
        // A non-decorator, non-method-definition line (method body, closing
        // brace, etc.) — not a new method; clear any stray pending
        // decorators so they don't get misattributed to a LATER method.
        pendingDecorators = "";
        continue;
      }

      const methodName = methodMatch[1]!;
      if (methodName !== "constructor") {
        let httpMethod: string | null = null;
        for (const m of HTTP_METHODS) {
          if (new RegExp(`@${m}\\(`).test(pendingDecorators)) {
            httpMethod = m.toUpperCase();
            break;
          }
        }
        if (httpMethod) {
          const methodHasSessionGuard = /@UseGuards\([^)]*SessionGuard[^)]*\)/.test(
            pendingDecorators,
          );
          const permissionMatch = /@RequirePermission\(\s*["']([^"']+)["']/.exec(pendingDecorators);
          handlers.push({
            file: relative(process.cwd(), file),
            methodName,
            httpMethod,
            hasSessionGuard: classHasSessionGuard || methodHasSessionGuard,
            requiredPermission: permissionMatch ? permissionMatch[1]! : null,
          });
        }
      }
      pendingDecorators = "";
    }
  }

  return handlers;
}

export interface PageRoute {
  file: string;
  /** URL path, route groups (parenthesized segments) stripped — e.g.
   * `apps/web/src/app/(auth)/login/page.tsx` -> `/login`. */
  routePath: string;
  hasServerGate: boolean;
}

/** Discovers every `page.tsx` under a Next.js app's `src/app` directory and
 * whether its source calls `requireUser`/`requirePermission` — the server-
 * side gate every protected page must call directly (checklist "guards in
 * layers... a check inside every... page"). */
export function discoverPages(appSrcDir: string): PageRoute[] {
  const files = listFilesRecursive(appSrcDir, (name) => name === "page.tsx");
  return files.map((file) => {
    const source = readFileSync(file, "utf8");
    const hasServerGate = /requireUser\(|requirePermission\(/.test(source);
    const relativePath = relative(appSrcDir, file);
    const withoutPageFile = relativePath.replace(/(^|[\\/])page\.tsx$/, "");
    const routePath =
      "/" +
      withoutPageFile
        .split(/[\\/]/)
        .filter((segment) => segment && !/^\(.*\)$/.test(segment)) // strip route groups like (auth)
        .join("/");
    return {
      file: relative(process.cwd(), file),
      routePath: routePath.replace(/\/+/g, "/"),
      hasServerGate,
    };
  });
}
