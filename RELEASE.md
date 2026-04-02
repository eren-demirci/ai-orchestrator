# Release Flow (SemVer)

This repository uses Semantic Versioning tags in the format `vMAJOR.MINOR.PATCH`.

## Standard Release Steps

1. Start from up-to-date `main`.
2. Run validation locally:

```bash
npm run build
npm run test
```

3. Bump version:

```bash
npm run release:patch
# or
npm run release:minor
# or
npm run release:major
```

4. Push commit and tag:

```bash
git push origin main --follow-tags
```

5. GitHub Actions `Release` workflow runs on the new tag (`v*.*.*`) and publishes a GitHub release with generated notes.

## Versioning Guidance

- `PATCH`: backward-compatible bug fixes
- `MINOR`: backward-compatible features
- `MAJOR`: breaking changes
