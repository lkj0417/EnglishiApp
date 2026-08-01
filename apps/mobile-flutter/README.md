# EasiTalk Flutter Mobile

Flutter target mobile app for the EasiTalk migration.

## Implemented screens

- Login / Register: `POST /v1/auth/login`, `POST /v1/auth/register`
- Today tasks: `GET /v1/users/{userId}/daily-tasks`, complete task
- Vocabulary: list, add, review words
- Writing correction: submit essay and view correction history
- Speaking practice: text-based speaking chat with simulated pronunciation score
- Speaking practice: text-based speaking chat with simulated pronunciation score

## Run

```powershell
cd apps/mobile-flutter
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001
```

For Windows desktop or web against local Go API, use:

```powershell
flutter run -d windows --dart-define=API_BASE_URL=http://localhost:3001
```

## Test

```powershell
cd apps/mobile-flutter
flutter test
```

