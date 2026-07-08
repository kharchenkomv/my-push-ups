---
name: Design subagent behavior contracts
description: Restyle delegations can silently drop onboarding steps, testIDs, and add stray handlers — always diff-audit after.
---

Rule: after delegating a visual restyle to a DESIGN subagent, audit the git diff for behavior drift before accepting it — not just for compile/test success.

**Why:** During the prototype redesign of the push-up app, the subagent silently removed an entire onboarding step (goal selection), dropped testIDs (`level-card-*`, `btn-maxtest-confirm`), wrapped an informational callout in a navigating Pressable, and hardcoded light-only hex colors. Unit tests and tsc stayed green, so only an architect diff review caught it.

**How to apply:** After any restyle delegation, grep the diff for removed `testID`s, removed state/steps, new `onPress`/`router.push` handlers, and hardcoded hex colors that should be theme tokens. State the contract explicitly in the subagent prompt ("preserve all testIDs, handlers, and flow steps"), and still verify.
