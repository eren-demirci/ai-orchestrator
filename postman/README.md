# Postman API Test Rehberi

Bu klasör AI Orchestrator API'sini test etmek için Postman collection içerir.

## Kurulum

1. **Postman'i açın** ve File > Import seçeneğini kullanın
2. `AI-Orchestrator.postman_collection.json` dosyasını import edin
3. Collection'ı açın ve Variables sekmesinden `base_url` değerini kontrol edin (varsayılan: `http://localhost:3000`)

## Test Senaryosu

### 1. İlk Kullanıcı Oluşturma

1. **Register User** request'ini çalıştırın:
   - Email: `test@example.com`
   - Password: `password123`
   - Role: `USER` veya `SUPER_ADMIN`

### 2. Authentication

1. **Login** request'ini çalıştırın:
   - Email: `test@example.com`
   - Password: `password123`
   - Response'da `access_token` alacaksınız (otomatik olarak `jwt_token` variable'ına kaydedilir)

### 3. API Key Oluşturma

1. **Create API Key** request'ini çalıştırın:
   - JWT token otomatik olarak kullanılır
   - Response'da `key` alacaksınız (otomatik olarak `api_key` variable'ına kaydedilir)

### 4. OpenAI Compatible Endpoints

#### Chat Completion (Non-Streaming)

1. **Chat Completion (Non-Streaming)** request'ini çalıştırın:
   - API Key otomatik olarak kullanılır
   - Model: `llama3` (veya kullanılabilir model)
   - Messages: Kullanıcı mesajı
   - `stream: false`

#### Chat Completion (Streaming)

1. **Chat Completion (Streaming)** request'ini çalıştırın:
   - `stream: true`
   - Response Server-Sent Events (SSE) formatında gelecek
   - Postman'de streaming response'u görmek için Console'u açın

#### Image Generation

1. **Image Generation** request'ini çalıştırın:
   - Prompt: Görsel açıklaması
   - Model: `sdxl` (veya kullanılabilir model)
   - Response'da `jobId` alacaksınız

2. **Get Image Generation Status** ile job durumunu kontrol edin

### 5. Task Management

1. **List Tasks** ile mevcut task'ları görüntüleyin
2. **Create Task (Admin)** ile yeni task oluşturun (SUPER_ADMIN gerekli)

### 6. Context / RAG

1. **Create Document** ile document oluşturun
2. **Search Context** ile benzer document'ları arayın
3. **Get Documents by Task** ile task'a özel document'ları görüntüleyin

### 7. Analytics

1. **Get User Stats** ile kullanıcı istatistiklerini görüntüleyin
2. **Get Request Logs (Admin)** ile tüm request log'larını görüntüleyin (SUPER_ADMIN gerekli)

## Authentication Yöntemleri

### JWT Token
- Header: `Authorization: Bearer <token>`
- Login endpoint'inden alınır
- Web/UI için kullanılır

### API Key
- Header: `Authorization: Bearer <api_key>` veya `x-api-key: <api_key>`
- Create API Key endpoint'inden alınır
- Programmatic erişim için kullanılır

## Önemli Notlar

1. **Streaming Responses**: Postman'de streaming response'ları görmek için:
   - Request'i gönderin
   - Console'u açın (View > Show Postman Console)
   - Response'u orada göreceksiniz

2. **Variables**: Collection variables otomatik olarak güncellenir:
   - `jwt_token`: Login sonrası
   - `api_key`: API key oluşturma sonrası
   - `user_id`: Register sonrası

3. **Admin Endpoints**: SUPER_ADMIN role'ü gerektirir:
   - Admin Users
   - Admin Config
   - Admin Analytics

4. **Error Handling**: 
   - 401: Authentication hatası (token/API key geçersiz)
   - 403: Authorization hatası (yetki yok)
   - 400: Validation hatası (request body hatalı)

## Environment Variables

Postman'de Environment oluşturarak farklı ortamlar için test yapabilirsiniz:

- **Development**: `http://localhost:3000`
- **Staging**: `https://staging.example.com`
- **Production**: `https://api.example.com`

## Örnek Test Senaryosu

```bash
# 1. Kullanıcı kaydı
POST /users/register
→ User oluşturulur

# 2. Login
POST /auth/login
→ JWT token alınır

# 3. API Key oluştur
POST /auth/api-keys
→ API Key alınır

# 4. Chat completion
POST /v1/chat/completions
Authorization: Bearer <api_key>
→ Response alınır

# 5. Analytics
GET /analytics/stats
Authorization: Bearer <jwt_token>
→ İstatistikler görüntülenir
```

## Troubleshooting

### Connection Refused
- Uygulamanın çalıştığından emin olun: `npm run start:dev`
- Port'un doğru olduğundan emin olun: `http://localhost:3000`

### 401 Unauthorized
- Token/API key'in geçerli olduğundan emin olun
- Login/API key oluşturma işlemini tekrar yapın

### 403 Forbidden
- Kullanıcının gerekli role'e sahip olduğundan emin olun
- SUPER_ADMIN endpoint'leri için role kontrolü yapın

### 500 Internal Server Error
- Server log'larını kontrol edin
- Database bağlantısını kontrol edin
- Ollama/ComfyUI servislerinin çalıştığından emin olun
