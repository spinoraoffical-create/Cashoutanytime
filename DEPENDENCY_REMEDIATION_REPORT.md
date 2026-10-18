# Dependency remediation

Date: 17 October 2026

Command: `npm audit --omit=dev`

Result: exit 0, 0 findings.

Production status: NOT DEPLOYED. The live site is still the older Next.js 15.5.19 build until a deploy is approved.

## What changed

| Package | Problem | Safe update applied |
| --- | --- | --- |
| `next` | Critical advisory on versions before 15.5.24 | Stays on 15.5.28 from the earlier local upgrade |
| `@tiptap/core` and the matching TipTap 3 packages | High findings through 3.30.4 | 3.32.0 |
| `@tiptap/extensions` and `@tiptap/extension-code-block` | Required by TipTap 3.32 | Added at 3.32.0 |
| `prosemirror-view` | High finding before 1.42.3 | Override 1.42.6 |
| `postcss` | High finding through 8.5.22, including the copy inside Next | 8.5.30 |
| `sharp` | High finding through the release candidate before 0.35.5 | 0.35.5 |
| `js-yaml` | High findings in 4.0.0 through 4.3.1 | Override 4.3.2 |
| `nanoid` | High finding through 3.3.17 | Override 3.3.20 |
| `brace-expansion` | High finding through 1.1.20 | Override 1.1.21 |
| `source-map-js` | High finding through 1.2.1 | Override 1.2.2 |

`npm audit fix --force` was not used. Next.js was not moved to version 16.

The editor imports `Placeholder` and `CharacterCount` from `@tiptap/extensions`, which is where TipTap 3.32 exports them. The production build compiled after that change.

## Remaining risk

Developer-only packages can still show findings in a full `npm audit` that includes them. The production command is clean. Those developer findings are not in the deployed server bundle until a package is also shipped to production. They are not a reason to run a forced major upgrade.

The clean audit is local. Production does not have these versions until deploy.
