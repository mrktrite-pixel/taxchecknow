// ─────────────────────────────────────────────────────────────────────────────
// COLE — guard-refusal.ts
//
// A GUARD REFUSAL IS NOT AN ERROR TO COLLECT. IT IS A STOP.
//
// cole-generate wraps each generation step in try/catch and pushes failures into
// an `errors[]` array so that one bad surface does not abandon the rest of a
// build. That is right for ordinary failures — a malformed FAQ should not stop
// the gate page from being written.
//
// It is exactly WRONG for a guard. When generate-calculator refuses to overwrite
// an engine-native wrapper, the run has been told that this product must not be
// rebuilt this way. Collecting that refusal and carrying on means the remaining
// steps still execute — and they are the destructive ones. That is precisely how
// SUPERLEAVE's hand-authored /api/rules corpus was overwritten on 2026-07-29:
// the calculator guard fired correctly, the script logged it, and then generated
// straight over the corpus anyway.
//
// A refusal that lets destructive work proceed is not a guard. Anything thrown as
// a GuardRefusal aborts the run at the point of refusal, before any further file
// is written.
// ─────────────────────────────────────────────────────────────────────────────

/** Thrown by a generator guard. Aborts the run; never collected into errors[]. */
export class GuardRefusal extends Error {
  readonly isGuardRefusal = true;
  /** Short guard identifier, e.g. "R-A2 calculator". Used in the abort banner. */
  readonly guard: string;

  constructor(guard: string, message: string) {
    super(message);
    this.name = "GuardRefusal";
    this.guard = guard;
    // Keep instanceof working when the class is transpiled to ES5 by ts-node.
    Object.setPrototypeOf(this, GuardRefusal.prototype);
  }
}

/**
 * Is this a guard refusal?
 *
 * Duck-typed rather than instanceof-only: the generators are loaded through
 * require() from several entry points (cole-generate, emit scripts, scratch
 * harnesses), and a second module instance would break a bare instanceof check.
 * A guard that fails open because of module identity is not a guard either.
 */
export function isGuardRefusal(err: unknown): err is GuardRefusal {
  return !!err && typeof err === "object" && (err as { isGuardRefusal?: boolean }).isGuardRefusal === true;
}

/**
 * Call FIRST in any catch block that would otherwise collect an error.
 * Re-throws guard refusals so they reach the top-level abort handler untouched.
 */
export function rethrowIfGuardRefusal(err: unknown): void {
  if (isGuardRefusal(err)) throw err;
}
