# Contributing

Thanks for contributing to AI Orchestrator.

## Development Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env
```

3. Start local dependencies (optional, Docker):

```bash
npm run infra:up
```

4. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Start the app:

```bash
npm run start:dev
```

## Before Opening a PR

Run the following checks locally:

```bash
npm run build
npm run test
```

If you changed formatting-sensitive files, also run:

```bash
npm run format
npm run lint
```

## Commit and PR Guidelines

- Keep PRs focused and reasonably small.
- Add or update tests for behavioral changes.
- Update README/docs when config or behavior changes.
- Never commit secrets, private keys, or internal-only infrastructure details.

## Reporting Bugs

Open a GitHub issue with:

- Reproduction steps
- Expected vs actual behavior
- Logs/errors (sanitized)
- Environment details (OS, Node version)
