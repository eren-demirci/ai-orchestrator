# AI Orchestrator

Task-based AI orchestrator for secure access to Ollama and ComfyUI, GPU resource management, context/RAG support, and an OpenAI-compatible API.

TR: Ollama ve ComfyUI servislerine güvenli erişim, GPU kaynak yönetimi, context/RAG desteği ve OpenAI uyumlu arayüz sağlayan görev tabanlı orkestrasyon sistemi.

## Highlights / Ozellikler

- JWT + API Key authentication
- Task-based orchestration
- GPU VRAM-aware scheduling and locking
- Context/RAG with pgvector
- OpenAI-compatible chat and image APIs
- Streaming (SSE) support
- Request logging and analytics
- Admin endpoints

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 17+ with `pgvector`
- Redis
- Docker + Docker Compose (optional, for local infra)

### Install

```bash
npm install
```

### Configure Environment

Create your `.env` file from the example:

```bash
cp .env.example .env
```

TR: Ardindan `.env` dosyasindaki degerleri kendi ortaminiza gore guncelleyin.

### Start Local Infra (Optional)

```bash
npm run infra:up
npm run infra:logs
```

Stop infra:

```bash
npm run infra:down
```

### Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
```

### Run App

```bash
npm run start:dev
```

Production:

```bash
npm run build
npm run start:prod
```

## Environment Variables

Use `.env.example` as the source of truth. Critical variables are validated at startup (fail-fast):

- `DATABASE_URL`
- `JWT_SECRET`
- `REDIS_HOST`
- `REDIS_PORT`

TR: Bu alanlar bos veya gecersizse uygulama acilista hata vererek durur.

## API Usage

### Register First User

```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123",
    "role": "SUPER_ADMIN"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

### Create API Key

```bash
curl -X POST http://localhost:3000/auth/api-keys \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My API Key"}'
```

### Chat Completions (OpenAI Compatible)

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"llama3",
    "messages":[{"role":"user","content":"Hello"}],
    "stream":false
  }'
```

### Image Generation

```bash
curl -X POST http://localhost:3000/v1/images/generations \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"A beautiful sunset over mountains",
    "size":"landscape"
  }'
```

## Common Endpoints

- `POST /auth/login`
- `POST /auth/api-keys`
- `POST /v1/chat/completions`
- `POST /v1/images/generations`
- `POST /tasks`
- `GET /tasks`
- `POST /context/documents`
- `POST /context/search`
- `GET /analytics/stats`
- `GET /admin/queues`

## Development

```bash
npm run start:dev
npm run build
npm run lint
npm run format
npm run test
```

## Production Notes

- Never commit secrets or private infrastructure details.
- Use strong `JWT_SECRET` values.
- Restrict admin endpoints behind proper auth and network controls.
- Rotate API keys and secrets regularly.

TR: Public yayin oncesi `.env`, token, anahtar ve ic ag bilgileri commit edilmediginden emin olun.

## Postman

Postman assets are available under `postman/`.

## Contributing and Security

- Contribution guidelines: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

MIT License. See [LICENSE](LICENSE).
