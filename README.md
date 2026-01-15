# AI Orchestrator

Task-based AI orchestrator sistemi. Ollama ve ComfyUI servislerine güvenli erişim, GPU kaynak yönetimi, context/RAG desteği ve OpenAI API uyumlu arayüz.

## Özellikler

- ✅ JWT + API Key Authentication
- ✅ Task-based Orchestration
- ✅ Resource-based GPU Management (VRAM tracking)
- ✅ Context/RAG Engine (pgvector)
- ✅ OpenAI API Compatible
- ✅ Streaming Support (SSE)
- ✅ Request Logging & Analytics
- ✅ Admin Panel (API)

## Kurulum

### 1. Gereksinimler

- Node.js 18+
- PostgreSQL 17+ (pgvector extension ile)
- Redis
- Docker & Docker Compose (opsiyonel)

### 2. Bağımlılıkları Yükle

```bash
npm install
```

### 3. Environment Variables

`.env` dosyası oluşturun:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ai_orchestrator"
SHADOW_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ai_orchestrator_shadow"

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=7d

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_API_KEY=

# ComfyUI
COMFYUI_BASE_URL=http://localhost:8188
COMFYUI_API_KEY=

# MinIO/S3 Storage
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_REGION=us-east-1
MINIO_BUCKET=ai-orchestrator

# GPU Configuration
GPU_0_TOTAL_VRAM=16
GPU_1_TOTAL_VRAM=8

# GPU SSH Configuration (for remote GPU management)
GPU_SSH_HOST=localhost
GPU_SSH_PORT=22
GPU_SSH_USER=root
GPU_SSH_PRIVATE_KEY=
GPU_SSH_PASSWORD=

# Provider Service Names (systemd service names)
OLLAMA_SERVICE_NAME=ollama
COMFYUI_SERVICE_NAME=comfyui

# Server
PORT=3000
NODE_ENV=development
```

### 4. Infrastructure (Docker)

```bash
# PostgreSQL ve Redis'i başlat
npm run infra:up

# Logları görüntüle
npm run infra:logs

# Durdur
npm run infra:down
```

### 5. Database Migration

```bash
# Prisma Client generate et
npm run prisma:generate

# Migration uygula
npm run prisma:migrate

# Prisma Studio (opsiyonel)
npm run prisma:studio
```

### 6. Uygulamayı Başlat

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## Kullanım

### 1. İlk Kullanıcı Oluşturma

```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123",
    "role": "SUPER_ADMIN"
  }'
```

### 2. Login ve Token Alma

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@example.com",
    "role": "SUPER_ADMIN"
  }
}
```

### 3. API Key Oluşturma

```bash
curl -X POST http://localhost:3000/auth/api-keys \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key"
  }'
```

Response:

```json
{
  "id": "...",
  "key": "sk_...",
  "name": "My API Key",
  "createdAt": "..."
}
```

**ÖNEMLİ**: API Key'i sadece bir kez gösterilir, kaydedin!

### 4. Chat Completion (OpenAI Compatible)

#### Non-Streaming

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 100,
    "stream": false
  }'
```

#### Streaming (SSE)

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [
      {
        "role": "user",
        "content": "Tell me a story"
      }
    ],
    "stream": true
  }' \
  --no-buffer
```

### 5. Image Generation

Flux model ile image generation. 4x upscale ile 4K'ya kadar çözünürlük desteği.

#### Size Preset ile (Önerilen)

```bash
curl -X POST http://localhost:3000/v1/images/generations \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "size": "landscape"
  }'
```

**Size Preset'ler:**

- `portrait`: 512x768 → 2048x3072 (4x upscale sonrası)
- `square`: 512x512 → 2048x2048 (4x upscale sonrası)
- `landscape`: 768x512 → 3072x2048 (4x upscale sonrası)

#### Özel Boyut ile

```bash
curl -X POST http://localhost:3000/v1/images/generations \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "width": 512,
    "height": 768
  }'
```

**Parametreler:**

- `prompt` (required): Image generation için prompt
- `size` (optional): Size preset - `portrait`, `square`, veya `landscape` (default: `square`)
- `width` (optional): Image genişliği (max 1024) - `size`'ı override eder
- `height` (optional): Image yüksekliği (max 1024) - `size`'ı override eder

**Not:**

- Tüm image'lar 4x upscale edilir (RealESRGAN model ile)
- Final çözünürlük 4K'yı (3840x2160) geçmez
- Oluşturulan image'lar MinIO/S3'e yüklenir ve response'da MinIO URL'i döner

Response:

```json
{
  "created": 1234567890,
  "data": [
    {
      "url": "http://localhost:3000/v1/images/<job_id>",
      "revised_prompt": "A beautiful sunset over mountains"
    }
  ]
}
```

### 6. Job Status Kontrolü

```bash
# Chat completion status
curl http://localhost:3000/v1/chat/completions/<job_id> \
  -H "Authorization: Bearer <api_key>"

# Image generation status
curl http://localhost:3000/v1/images/generations/<job_id> \
  -H "Authorization: Bearer <api_key>"
```

### 7. Task Yönetimi (Admin)

#### Task Oluşturma

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "STUDENT_WEEKLY_ANALYSIS",
    "name": "Student Weekly Analysis",
    "description": "Analyze student performance weekly",
    "allowedModels": ["llama3", "gpt-4o"],
    "maxCost": 0.02,
    "requiresRAG": true,
    "tools": ["db", "pdf"],
    "maxTokens": 2000,
    "minTemperature": 0.0,
    "maxTemperature": 1.0
  }'
```

#### Task Listesi

```bash
curl http://localhost:3000/tasks \
  -H "Authorization: Bearer <jwt_token>"
```

### 8. Context/RAG Kullanımı

#### Document Oluşturma

```bash
curl -X POST http://localhost:3000/context/documents \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a sample document about AI and machine learning.",
    "taskId": "STUDENT_WEEKLY_ANALYSIS",
    "metadata": {
      "source": "textbook",
      "chapter": 1
    }
  }'
```

#### Context Arama

```bash
curl -X POST http://localhost:3000/context/search \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is deep learning?",
    "taskId": "STUDENT_WEEKLY_ANALYSIS",
    "limit": 5
  }'
```

### 9. Analytics

#### Kullanıcı İstatistikleri

```bash
curl http://localhost:3000/analytics/stats \
  -H "Authorization: Bearer <jwt_token>"
```

#### Request Logs (Admin)

```bash
curl "http://localhost:3000/admin/analytics/logs?limit=100&offset=0" \
  -H "Authorization: Bearer <jwt_token>"
```

### 10. Admin İşlemleri

#### Model Config Oluşturma

```bash
curl -X POST http://localhost:3000/admin/config/models \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "llama3",
    "provider": "ollama",
    "maxTokens": 2000,
    "minTemperature": 0.0,
    "maxTemperature": 2.0,
    "estimatedVRAM": 10.0,
    "defaultParams": {
      "top_p": 0.9
    },
    "isActive": true
  }'
```

#### Kullanıcı Listesi

```bash
curl http://localhost:3000/admin/users \
  -H "Authorization: Bearer <jwt_token>"
```

## Postman Collection

Postman ile test etmek için:

1. Postman'i açın
2. File > Import
3. `postman/AI-Orchestrator.postman_collection.json` dosyasını import edin
4. Collection variables'ı kontrol edin (`base_url` varsayılan: `http://localhost:3000`)

Detaylı kullanım için `postman/README.md` dosyasına bakın.

## API Endpoints

### Authentication

- `POST /users/register` - Kullanıcı kaydı
- `POST /auth/login` - Login (JWT token al)
- `POST /auth/api-keys` - API Key oluştur
- `GET /auth/api-keys` - API Key listesi
- `DELETE /auth/api-keys/:id` - API Key iptal et
- `GET /users/profile` - Kullanıcı profili

### OpenAI Compatible

- `POST /v1/chat/completions` - Chat completion (streaming/non-streaming)
- `GET /v1/chat/completions/:jobId` - Job status
- `POST /v1/images/generations` - Image generation
- `GET /v1/images/generations/:jobId` - Job status

### Tasks

- `GET /tasks` - Task listesi
- `GET /tasks/:id` - Task detayı
- `POST /tasks` - Task oluştur (Admin)
- `PUT /tasks/:id` - Task güncelle (Admin)
- `DELETE /tasks/:id` - Task sil (Admin)

### Context/RAG

- `POST /context/documents` - Document oluştur
- `POST /context/search` - Context arama
- `GET /context/documents/task/:taskId` - Task'a özel document'lar
- `DELETE /context/documents/:id` - Document sil

### Analytics

- `GET /analytics/stats` - Kullanıcı istatistikleri
- `GET /admin/analytics/logs` - Request logs (Admin)

### Admin

- `GET /admin/users` - Kullanıcı listesi (Admin)
- `GET /admin/users/:id` - Kullanıcı detayı (Admin)
- `PUT /admin/users/:id/role` - Kullanıcı role güncelle (Admin)
- `GET /admin/config/models` - Model config listesi (Admin)
- `POST /admin/config/models` - Model config oluştur (Admin)
- `PUT /admin/config/models/:modelName` - Model config güncelle (Admin)
- `DELETE /admin/config/models/:modelName` - Model config sil (Admin)

## GPU Resource Management

Sistem otomatik olarak GPU kaynaklarını yönetir:

- **Ollama** ve **ComfyUI** aynı anda çalışmaz (ilk versiyon)
- VRAM tracking ile resource-based allocation (ileride genişletilebilir)
- Redis-based distributed lock ile race condition önleme

## Task-Based Orchestration

Her request bir task ile ilişkilendirilir:

1. **Task Identification**: Model name'den veya explicit `task_id` parametresinden
2. **Policy Validation**: Task policy'ye göre model, temperature, max_tokens kontrolü
3. **Context Building**: `requiresRAG=true` ise context builder çalışır
4. **Model Routing**: Task'a göre en uygun model seçilir
5. **Execution**: Streaming ise direct execution, değilse queue

## Streaming vs Queue

- **Streaming Requests**: Direct execution (queue bypass) - SSE connection yönetimi
- **Non-Streaming Requests**: Queue (BullMQ) - async job processing

## Troubleshooting

### Database Connection Error

- PostgreSQL'in çalıştığından emin olun: `npm run infra:up`
- `.env` dosyasındaki `DATABASE_URL`'i kontrol edin

### Redis Connection Error

- Redis'in çalıştığından emin olun: `npm run infra:up`
- `.env` dosyasındaki `REDIS_HOST` ve `REDIS_PORT`'u kontrol edin

### Ollama/ComfyUI Connection Error

- Ollama ve ComfyUI servislerinin çalıştığından emin olun
- `.env` dosyasındaki `OLLAMA_BASE_URL` ve `COMFYUI_BASE_URL`'i kontrol edin

### GPU Lock Error

- GPU resource manager'ın doğru çalıştığından emin olun
- Redis bağlantısını kontrol edin

### Migration Error

- `npm run prisma:generate` çalıştırın
- `npm run prisma:migrate` ile migration'ları uygulayın

## Development

```bash
# Watch mode
npm run start:dev

# Build
npm run build

# Lint
npm run lint

# Format
npm run format

# Test
npm run test
```

## Production Deployment

1. Environment variables'ı production değerleriyle güncelleyin
2. Build alın: `npm run build`
3. Start: `npm run start:prod`

## License

UNLICENSED
# ai-orchestrator
