# Infrastructure Setup

Bu klasör Docker Compose ile PostgreSQL ve Redis servislerini içerir.

## Kurulum

1. `.env` dosyasını oluşturun (`.env.example`'dan kopyalayın):
```bash
cp .env.example .env
```

2. Servisleri başlatın:
```bash
docker-compose up -d
```

3. Servisleri durdurun:
```bash
docker-compose down
```

4. Verileri silerek durdurun:
```bash
docker-compose down -v
```

## Servisler

- **PostgreSQL**: Port 5433 (pgvector extension ile)
- **Redis**: Port 6379

## Bağlantı Bilgileri

PostgreSQL connection string:
```
postgresql://postgres:postgres@localhost:5433/ai_orchestrator
```

Redis connection:
```
localhost:6379
```

## Kullanım

### Servisleri Başlatma

```bash
cd infra
docker-compose up -d
```

### Servisleri Durdurma

```bash
cd infra
docker-compose down
```

### Verileri Silerek Durdurma

```bash
cd infra
docker-compose down -v
```

### Logları Görüntüleme

```bash
cd infra
docker-compose logs -f
```

### Servis Durumunu Kontrol Etme

```bash
cd infra
docker-compose ps
```

## pgvector Extension

PostgreSQL container'ı pgvector extension'ı ile birlikte gelir. Migration'lar otomatik olarak extension'ı oluşturacaktır.
