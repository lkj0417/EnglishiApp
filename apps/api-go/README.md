# EasiTalk Go API

Go Gin + Gorm business API for EasiTalk V1.0 migration.

## Local run

```powershell
cd apps/api-go
go mod tidy
go run ./cmd/api
```

## Endpoints

- `GET /health`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `GET /v1/users/{userId}/profile`
- `PUT /v1/users/{userId}/profile`
- `GET /v1/users/{userId}/daily-tasks?date=YYYY-MM-DD`
- `POST /v1/users/{userId}/daily-tasks/generate`
- `POST /v1/users/{userId}/daily-tasks/{taskId}/complete`
- `GET /v1/users/{userId}/words`
- `POST /v1/users/{userId}/words`
- `POST /v1/users/{userId}/words/{wordId}/review`
- `DELETE /v1/users/{userId}/words/{wordId}`
- `GET /v1/users/{userId}/error-records?sourceType=speaking`
- `POST /v1/users/{userId}/error-records`
- `GET /v1/users/{userId}/writing-submissions`
- `POST /v1/users/{userId}/writing-submissions/correct`
- `POST /v1/users/{userId}/audio-assets`
- `GET /v1/users/{userId}/speaking-sessions`
- `POST /v1/users/{userId}/speaking/chat`
- `POST /v1/users/{userId}/audio-assets`
- `GET /v1/users/{userId}/speaking-sessions`
- `POST /v1/users/{userId}/speaking/chat`

