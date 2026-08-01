# EnglishiApp — 第六阶段：技术栈迁移实施方案

> 版本：v1.0 | 日期：2026-08-01 | 状态：待确认  
> 前置依赖：`Phase5_EasiTalkAI系统架构设计文档_V1.0.md`  
> 迁移决策：当前 EnglishiApp 已有 TypeScript 架构**不保留**，整体迁移至 Flutter + Go Gin + Python FastAPI + MySQL 架构。

---

## 目录

1. [迁移目标与边界](#1-迁移目标与边界)
2. [当前架构基线](#2-当前架构基线)
3. [目标架构定义](#3-目标架构定义)
4. [迁移总原则](#4-迁移总原则)
5. [目录与工程结构迁移方案](#5-目录与工程结构迁移方案)
6. [移动端迁移方案：Expo React Native → Flutter](#6-移动端迁移方案expo-react-native--flutter)
7. [后端 API 迁移方案：TypeScript Fastify → Go Gin](#7-后端-api-迁移方案typescript-fastify--go-gin)
8. [数据库迁移方案：PostgreSQL → MySQL](#8-数据库迁移方案postgresql--mysql)
9. [AI Service 迁移方案：TypeScript → Python FastAPI](#9-ai-service-迁移方案typescript--python-fastapi)
10. [接口契约与联调策略](#10-接口契约与联调策略)
11. [Docker Compose 与环境变量迁移方案](#11-docker-compose-与环境变量迁移方案)
12. [数据迁移与回滚方案](#12-数据迁移与回滚方案)
13. [测试验收方案](#13-测试验收方案)
14. [迁移里程碑计划](#14-迁移里程碑计划)
15. [风险清单与应对策略](#15-风险清单与应对策略)
16. [最终下线清单](#16-最终下线清单)

---

## 1. 迁移目标与边界

### 1.1 迁移目标

本阶段目标是将当前 EnglishiApp 已有 TypeScript 技术栈整体替换为 Phase5 定义的 EasiTalk AI V1.0 目标架构：

| 层级 | 当前实现 | 目标实现 | 是否保留当前实现 |
|---|---|---|---|
| 移动端 | Expo React Native / TypeScript | Flutter 3.20+ | 不保留 |
| 后端 API | Node.js / TypeScript / Fastify | Go 1.21+ / Gin / Gorm | 不保留 |
| AI Service | Node.js / TypeScript / Fastify | Python 3.10+ / FastAPI | 不保留 |
| 数据库 | PostgreSQL 16 + pgvector / Drizzle | MySQL 8.0 / Gorm / SQLAlchemy 或原生 SQL | 不保留 PostgreSQL |
| 缓存 | Redis 7 | Redis 7 | 保留能力，重建接入代码 |
| 对象存储 | 当前 Docker Compose 未配置独立对象存储 | MinIO | 新增 |
| 管理后台 | Next.js / TypeScript | 待二次确认 | 本方案默认暂缓迁移，不作为 V1.0 核心阻断项 |

### 1.2 迁移边界

本方案覆盖：

- 客户端工程从 Expo React Native 迁移到 Flutter。
- 后端业务服务从 TypeScript Fastify 迁移到 Go Gin。
- AI Service 从 TypeScript Fastify 迁移到 Python FastAPI。
- 数据库从 PostgreSQL 切换到 MySQL。
- Docker Compose 从 PostgreSQL 服务切换到 MySQL + MinIO。
- 接口契约、数据模型、鉴权、缓存、文件存储、CI/CD 脚本同步迁移。

本方案不覆盖或暂缓覆盖：

- 已有 Next.js 管理后台的完整重写。若继续使用管理后台，需要后续单独制定 Web 管理端迁移方案。
- 历史 PostgreSQL 数据的生产级在线零停机迁移。V1.0 默认采用离线迁移窗口。
- K8s 生产编排。V1.0 仍以 Docker Compose 为快速落地方案。

### 1.3 迁移完成定义

当以下条件全部满足时，视为迁移完成：

- [ ] Flutter App 能完成注册、登录、测评、每日任务、听说读写核心学习闭环。
- [ ] Go Gin API 替代原 `apps/api` TypeScript 服务并通过接口验收。
- [ ] Python FastAPI AI Service 替代原 `apps/ai-service` TypeScript 服务并通过 AI 任务验收。
- [ ] MySQL 成为唯一主数据库，业务运行不再依赖 PostgreSQL。
- [ ] MinIO 承载口语录音、TTS 音频、学习素材等对象文件。
- [ ] Docker Compose 可一键启动新架构。
- [ ] 旧 TypeScript API、AI Service、移动端不再参与运行链路。

---

## 2. 当前架构基线

基于当前仓库结构，迁移前基线如下：

```text
EnglishiApp/
├─ apps/
│  ├─ mobile/       # Expo React Native + TypeScript 移动端
│  ├─ api/          # Node.js + TypeScript + Fastify 业务 API
│  ├─ ai-service/   # Node.js + TypeScript + Fastify AI 服务与 Workers
│  └─ admin/        # Next.js 管理后台
├─ packages/
│  ├─ database/     # Drizzle ORM + PostgreSQL schema/migration/seed
│  ├─ shared-types/ # TypeScript 共享类型
│  └─ cefr-utils/   # TypeScript CEFR 工具包
├─ docker-compose.yml
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

### 2.1 当前核心技术栈

| 模块 | 当前技术栈 | 关键文件或目录 |
|---|---|---|
| Monorepo | pnpm workspace + Turborepo | `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| 移动端 | Expo 51 / React Native / TypeScript | `apps/mobile` |
| API | Fastify / TypeScript / Drizzle / Redis / BullMQ | `apps/api` |
| AI Service | Fastify / TypeScript / OpenAI SDK / BullMQ | `apps/ai-service` |
| 数据库 | PostgreSQL 16 + pgvector / Drizzle | `packages/database` |
| 管理后台 | Next.js 14 / TypeScript | `apps/admin` |
| 部署 | Docker Compose | `docker-compose.yml` |

### 2.2 当前需替换的核心资产

- `apps/mobile`：整体替换为 Flutter 工程。
- `apps/api`：整体替换为 Go Gin 工程。
- `apps/ai-service`：整体替换为 Python FastAPI 工程。
- `packages/database`：Drizzle + PostgreSQL 迁移逻辑废弃，改为 MySQL 建表与迁移机制。
- `packages/shared-types`：不再作为跨端共享类型唯一来源，改由 OpenAPI Schema / JSON Schema / protobuf 等接口契约生成。
- `docker-compose.yml`：PostgreSQL 替换为 MySQL，新增 MinIO。
- 根 `package.json`、`turbo.json`、`pnpm-workspace.yaml`：迁移后仅保留与管理后台或过渡工具相关内容，核心服务不再依赖 TypeScript workspace。

---

## 3. 目标架构定义

### 3.1 目标五层架构

```text
┌──────────────────────────────────────────────────────────────┐
│ 客户端层：Flutter App（Android / iOS）                         │
│ UI交互 / 语音采集 / 本地缓存 / 音频播放                         │
└───────────────────────────────┬──────────────────────────────┘
                                │ HTTPS / WebSocket / Upload
┌───────────────────────────────▼──────────────────────────────┐
│ 网关层：API Gateway 或 Go API 内置网关能力                      │
│ 鉴权 / 限流 / 路由分发 / 请求预处理 / CORS                       │
└───────────────────────────────┬──────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
┌─────────────▼─────────────┐       ┌─────────────▼─────────────┐
│ 业务服务层：Go Gin          │       │ 智能服务层：Python FastAPI  │
│ 用户/任务/知识库/统计/配置   │       │ LLM/Prompt/Memory/ASR/TTS   │
└─────────────┬─────────────┘       └─────────────┬─────────────┘
              │                                   │
              └─────────────────┬─────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────┐
│ 数据存储层：MySQL 8.0 / Redis 7 / MinIO                        │
│ 结构化数据 / 缓存会话 / 音频与素材对象存储                      │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 目标工程结构建议

```text
EnglishiApp/
├─ apps/
│  ├─ mobile-flutter/          # 新 Flutter App，完成后可重命名为 mobile
│  ├─ api-go/                  # 新 Go Gin 业务 API，完成后可重命名为 api
│  ├─ ai-service-python/       # 新 Python FastAPI AI Service，完成后可重命名为 ai-service
│  └─ admin/                   # 暂缓迁移，后续单独评估
├─ services/
│  └─ gateway/                 # 可选：独立 API Gateway，如 V1.0 不独立则由 api-go 承担
├─ packages/
│  ├─ contracts/               # OpenAPI / JSON Schema 接口契约
│  └─ docs/                    # 可选：接口说明、ERD、Prompt 文档
├─ infra/
│  ├─ docker/
│  ├─ mysql/
│  ├─ minio/
│  └─ scripts/
├─ docker-compose.yml
└─ README.md
```

### 3.3 命名策略

为降低迁移期间的冲突，采用“两阶段目录命名”：

1. **并行开发阶段**：新增 `mobile-flutter`、`api-go`、`ai-service-python`，旧目录暂不删除。
2. **切换完成阶段**：旧目录归档或删除，新目录重命名为 `mobile`、`api`、`ai-service`。

---

## 4. 迁移总原则

### 4.1 不保留当前 TypeScript 架构

本次迁移明确：当前 TypeScript 架构不作为长期保留方案。迁移完成后：

- 移动端不再使用 Expo React Native。
- 业务 API 不再使用 Fastify / TypeScript。
- AI Service 不再使用 Fastify / TypeScript。
- 主数据库不再使用 PostgreSQL。
- Drizzle ORM 不再作为核心数据库迁移工具。

### 4.2 先契约，后实现

迁移不应从代码照搬开始，而应先稳定接口契约：

1. 梳理旧接口行为。
2. 定义新 OpenAPI 文档。
3. Flutter、Go、Python 均以契约为准开发。
4. 所有联调以接口契约与验收用例为准。

### 4.3 数据模型优先

数据库切换影响最大，必须优先确定：

- MySQL 表结构。
- 字段类型映射。
- 索引策略。
- JSON 字段兼容策略。
- 历史数据迁移脚本。
- 回滚备份方式。

### 4.4 功能分批迁移

按照核心闭环优先级迁移：

1. 用户注册登录与学习档案。
2. 初始测评与能力模型。
3. 每日任务。
4. 生词与错题。
5. 口语、写作 AI 能力。
6. 听力、阅读、语法等内容生成能力。
7. 数据统计与报告。
8. 管理后台适配。

---

## 5. 目录与工程结构迁移方案

### 5.1 新增目录

| 目录 | 说明 | 迁移阶段 |
|---|---|---|
| `apps/mobile-flutter` | Flutter 新移动端工程 | M1 |
| `apps/api-go` | Go Gin 新业务 API | M1 |
| `apps/ai-service-python` | Python FastAPI 新 AI Service | M1 |
| `packages/contracts` | OpenAPI / JSON Schema 契约 | M1 |
| `infra/mysql` | MySQL 初始化脚本、迁移脚本 | M1 |
| `infra/minio` | MinIO bucket 初始化脚本 | M2 |
| `infra/scripts` | 数据导出、转换、导入、校验脚本 | M2 |

### 5.2 暂时保留但标记废弃的目录

迁移开发期间暂时保留以下目录用于行为对照和数据迁移参考：

| 目录 | 迁移用途 | 最终处理 |
|---|---|---|
| `apps/mobile` | 旧 UI 流程与接口调用参考 | 迁移完成后删除或归档 |
| `apps/api` | 旧 REST / WebSocket 行为参考 | 迁移完成后删除或归档 |
| `apps/ai-service` | 旧 AI Prompt、Worker、接口行为参考 | 迁移完成后删除或归档 |
| `packages/database` | 旧 PostgreSQL schema 与 seed 参考 | MySQL 迁移完成后删除或归档 |
| `packages/shared-types` | 旧 DTO / 枚举参考 | 契约生成稳定后删除或归档 |
| `packages/cefr-utils` | CEFR 算法参考 | 可迁移为 Go / Dart / Python 实现后删除或归档 |

### 5.3 最终目录收敛

迁移完成后目标结构：

```text
apps/
├─ mobile/       # Flutter
├─ api/          # Go Gin
├─ ai-service/   # Python FastAPI
└─ admin/        # 后续迁移或保留为独立管理后台
```

---

## 6. 移动端迁移方案：Expo React Native → Flutter

### 6.1 技术目标

| 项 | 目标 |
|---|---|
| Flutter 版本 | 3.20+ |
| 状态管理 | Provider + GetX |
| 网络请求 | Dio |
| 本地缓存 | Hive |
| 音频录制 | Flutter 原生录音插件 |
| 音频播放 | Flutter 音频播放插件 |
| 图表 | FL Chart |

### 6.2 Flutter 工程分层

```text
apps/mobile-flutter/lib/
├─ main.dart
├─ app.dart
├─ core/
│  ├─ config/
│  ├─ network/
│  ├─ storage/
│  ├─ auth/
│  └─ errors/
├─ features/
│  ├─ auth/
│  ├─ assessment/
│  ├─ daily_task/
│  ├─ vocabulary/
│  ├─ speaking/
│  ├─ writing/
│  ├─ listening/
│  ├─ reading/
│  ├─ grammar/
│  └─ profile/
├─ shared/
│  ├─ widgets/
│  ├─ models/
│  └─ utils/
└─ routes/
```

### 6.3 迁移步骤

1. 初始化 Flutter 工程：`apps/mobile-flutter`。
2. 建立统一网络层：
   - Base URL 配置。
   - Token 注入。
   - Token 刷新。
   - 统一错误处理。
3. 迁移认证模块：
   - 登录。
   - 注册。
   - 用户信息。
4. 迁移首页与每日任务模块。
5. 迁移测评模块。
6. 迁移生词、错题、本地缓存。
7. 迁移听说读写核心学习页面。
8. 接入录音、上传、播放、TTS 音频。
9. 迁移学习数据图表。
10. 完成 Android / iOS 真机验收。

### 6.4 验收标准

- [ ] Android 可运行。
- [ ] iOS 可运行。
- [ ] 登录态可持久化。
- [ ] 所有核心 REST API 可调用。
- [ ] 录音、上传、播放闭环可用。
- [ ] 离线生词与本地学习记录可缓存。
- [ ] UI 功能覆盖旧移动端核心流程。

---

## 7. 后端 API 迁移方案：TypeScript Fastify → Go Gin

### 7.1 技术目标

| 项 | 目标 |
|---|---|
| Go 版本 | 1.21+ |
| Web 框架 | Gin |
| ORM | Gorm |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7 |
| 鉴权 | JWT + Redis 登录态 |
| 接口文档 | Swagger / OpenAPI |
| 配置 | `.env` + typed config |

### 7.2 Go API 工程结构

```text
apps/api-go/
├─ cmd/
│  └─ api/
│     └─ main.go
├─ internal/
│  ├─ config/
│  ├─ server/
│  ├─ middleware/
│  ├─ modules/
│  │  ├─ user/
│  │  ├─ assessment/
│  │  ├─ daily_task/
│  │  ├─ vocabulary/
│  │  ├─ error_record/
│  │  ├─ progress/
│  │  ├─ setting/
│  │  └─ knowledge/
│  ├─ repository/
│  ├─ service/
│  ├─ dto/
│  └─ response/
├─ pkg/
│  ├─ jwt/
│  ├─ redis/
│  ├─ mysql/
│  └─ logger/
├─ migrations/
├─ docs/
├─ Dockerfile.dev
├─ go.mod
└─ go.sum
```

### 7.3 API 模块迁移映射

| 旧 TypeScript 模块 | 新 Go 模块 | 说明 |
|---|---|---|
| `user` | `internal/modules/user` | 注册、登录、资料、学习档案 |
| `assessment` | `internal/modules/assessment` | 初始测评、能力评估 |
| `progress` | `internal/modules/progress` | 学习进度、统计、打卡 |
| `vocabulary` | `internal/modules/vocabulary` | 生词、复习、记忆状态 |
| `grammar` | `internal/modules/knowledge` 或 `grammar` | 语法任务与错题 |
| `reading` | `internal/modules/knowledge` 或 `reading` | 阅读学习记录 |
| `listening` | `internal/modules/knowledge` 或 `listening` | 听力学习记录 |
| `speaking` | `internal/modules/speaking` | 口语会话入口、上传转发 |
| `writing` | `internal/modules/writing` | 写作提交、结果查询 |
| `admin` | 暂缓 | 管理后台适配后再迁移 |

### 7.4 Go API 迁移步骤

1. 新建 `apps/api-go`。
2. 建立 Gin Server、健康检查、统一响应格式、统一错误码。
3. 接入 MySQL、Redis、日志、配置。
4. 定义 Gorm Model 与 Repository。
5. 实现用户认证与 JWT 中间件。
6. 迁移用户学习档案。
7. 迁移每日任务、生词、错题、设置、统计模块。
8. 建立与 Python AI Service 的内部调用客户端。
9. 生成 Swagger 文档。
10. 与 Flutter 按 OpenAPI 契约联调。

### 7.5 Go API 验收标准

- [ ] `/health` 返回正常。
- [ ] 用户注册、登录、刷新 Token 可用。
- [ ] JWT + Redis 登录态校验可用。
- [ ] MySQL CRUD 正常。
- [ ] 核心业务接口通过契约测试。
- [ ] 能正确调用 Python AI Service。
- [ ] Docker Compose 中可启动。

---

## 8. 数据库迁移方案：PostgreSQL → MySQL

### 8.1 迁移目标

- MySQL 8.0 成为唯一主数据库。
- Redis 继续作为缓存与会话存储。
- MinIO 存储音频文件与学习素材。
- PostgreSQL、pgvector、Drizzle 迁移完成后下线。

### 8.2 类型映射规则

| PostgreSQL 类型 | MySQL 类型 | 说明 |
|---|---|---|
| `uuid` | `CHAR(36)` 或 `BIGINT` | V1.0 建议统一 BIGINT 自增或雪花 ID |
| `text` | `TEXT` / `LONGTEXT` | 按内容长度选择 |
| `jsonb` | `JSON` | MySQL 8.0 原生 JSON |
| `timestamp` | `DATETIME(3)` | 保留毫秒精度 |
| `boolean` | `TINYINT(1)` | Gorm 可映射 bool |
| `numeric` | `DECIMAL` | 分数、金额、能力值 |
| `vector` | 暂不迁移或拆分为 JSON | V1.0 若无向量检索强依赖，可暂缓 |

### 8.3 MySQL 核心表

迁移后的核心表以 Phase5 为准：

- `user`
- `user_learning_profile`
- `user_word`
- `user_error_record`
- `user_daily_task`
- `ai_chat_history`
- `user_setting`

同时根据当前业务闭环补充：

- `assessment_record`
- `learning_event`
- `ability_snapshot`
- `writing_submission`
- `speaking_session`
- `audio_asset`
- `prompt_version`

### 8.4 索引策略

| 表 | 索引 |
|---|---|
| `user` | `idx_user_phone`, `idx_user_email` |
| `user_learning_profile` | `uk_profile_user_id` |
| `user_word` | `idx_word_user_next_review`, `idx_word_user_word` |
| `user_error_record` | `idx_error_user_type_time` |
| `user_daily_task` | `idx_task_user_date_status` |
| `ai_chat_history` | `idx_chat_user_session_time` |
| `learning_event` | `idx_event_user_type_time` |
| `ability_snapshot` | `idx_snapshot_user_date` |

### 8.5 数据迁移步骤

```text
1. 冻结旧系统写入
   ↓
2. PostgreSQL 全量备份
   ↓
3. 导出核心表数据为 CSV / JSON
   ↓
4. 执行字段转换与类型转换
   ↓
5. 初始化 MySQL schema
   ↓
6. 导入 MySQL
   ↓
7. 执行数据校验
   ↓
8. 启动新 Go API / Python AI Service
   ↓
9. Flutter 客户端联调验收
   ↓
10. 切换流量
```

### 8.6 数据校验标准

- [ ] 用户数量一致。
- [ ] 学习档案数量一致。
- [ ] 生词数量一致。
- [ ] 错题数量一致。
- [ ] 每日任务数量一致。
- [ ] AI 对话历史可按用户查询。
- [ ] 核心用户抽样登录后学习数据完整。
- [ ] 迁移后无孤儿用户 ID。

---

## 9. AI Service 迁移方案：TypeScript → Python FastAPI

### 9.1 技术目标

| 项 | 目标 |
|---|---|
| Python 版本 | 3.10+ |
| 服务框架 | FastAPI |
| 异步运行 | Uvicorn / Gunicorn + Uvicorn Workers |
| 数据访问 | SQLAlchemy / PyMySQL 或 aiomysql |
| 缓存 | redis-py / aioredis |
| 大模型 | OpenAI / 豆包 API 兼容层 |
| 参数校验 | Pydantic |
| 任务处理 | Celery / RQ / Dramatiq，V1.0 可先轻量化 |

### 9.2 Python AI Service 工程结构

```text
apps/ai-service-python/
├─ app/
│  ├─ main.py
│  ├─ core/
│  │  ├─ config.py
│  │  ├─ logging.py
│  │  └─ errors.py
│  ├─ api/
│  │  ├─ routes_health.py
│  │  ├─ routes_plan.py
│  │  ├─ routes_speaking.py
│  │  ├─ routes_writing.py
│  │  └─ routes_chat.py
│  ├─ agents/
│  │  ├─ memory_manager.py
│  │  ├─ prompt_manager.py
│  │  ├─ context_manager.py
│  │  └─ adaptive_scheduler.py
│  ├─ clients/
│  │  ├─ llm_client.py
│  │  ├─ asr_client.py
│  │  ├─ tts_client.py
│  │  └─ pronunciation_client.py
│  ├─ repositories/
│  ├─ schemas/
│  ├─ services/
│  └─ prompts/
├─ tests/
├─ Dockerfile.dev
├─ pyproject.toml
└─ README.md
```

### 9.3 AI 能力迁移映射

| 旧 TypeScript 能力 | 新 Python 模块 | 说明 |
|---|---|---|
| OpenAI Client | `clients/llm_client.py` | 统一模型兼容层 |
| Reading Engine | `services/reading_service.py` | 阅读材料生成与解析 |
| Speaking Engine | `services/speaking_service.py` | 口语对话、纠音、TTS |
| Writing Engine | `services/writing_service.py` | 写作批改、范文、错题提取 |
| Workers | `services/task_service.py` 或队列模块 | 异步任务处理 |
| Prompt 文件 | `prompts/` + `prompt_version` | 本地 + DB 双托管 |

### 9.4 AI Agent 标准接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `/health` | GET | 健康检查 |
| `/v1/plan/generate` | POST | 生成每日学习计划 |
| `/v1/speaking/chat` | POST | 口语对话文本轮次 |
| `/v1/speaking/evaluate` | POST | 口语发音评测 |
| `/v1/writing/correct` | POST | 写作批改 |
| `/v1/chat/tutor` | POST | AI 外教问答 |
| `/v1/context/clear` | POST | 清理会话上下文 |

### 9.5 AI Service 验收标准

- [ ] `/health` 正常。
- [ ] 能读取 MySQL 用户学习档案。
- [ ] 能读取 / 写入 Redis 会话上下文。
- [ ] 能加载系统 Prompt 与任务 Prompt。
- [ ] 能调用大模型 API。
- [ ] 能返回结构化写作批改结果。
- [ ] 能完成口语 ASR → AI 回复 → 发音评测 → TTS 链路。
- [ ] 能将生词、错题、薄弱点写回 MySQL。

---

## 10. 接口契约与联调策略

### 10.1 契约优先级

迁移期间，接口契约优先级高于旧代码实现。

推荐将契约文件放置于：

```text
packages/contracts/
├─ openapi.yaml
├─ schemas/
│  ├─ user.schema.json
│  ├─ task.schema.json
│  ├─ vocabulary.schema.json
│  ├─ speaking.schema.json
│  └─ writing.schema.json
└─ examples/
```

### 10.2 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "traceId": "req_xxx"
}
```

### 10.3 错误码规范

| 区间 | 含义 |
|---|---|
| `0` | 成功 |
| `10000-19999` | 通用错误 |
| `20000-29999` | 用户与认证错误 |
| `30000-39999` | 学习任务错误 |
| `40000-49999` | AI 服务错误 |
| `50000-59999` | 语音服务错误 |

### 10.4 联调顺序

1. Go API Mock AI Service，Flutter 联调基础业务。
2. Python AI Service Mock LLM，Go API 联调 AI 路由。
3. 接入真实 LLM / ASR / TTS。
4. Flutter 端联调口语与写作完整链路。
5. 全链路压测与异常测试。

---

## 11. Docker Compose 与环境变量迁移方案

### 11.1 服务变化

| 当前服务 | 目标处理 |
|---|---|
| `postgres` | 删除，替换为 `mysql` |
| `redis` | 保留 |
| `api` | 替换为 Go API 镜像 |
| `ai-service` | 替换为 Python FastAPI 镜像 |
| `admin` | 暂缓，若继续使用需改 API 地址与认证适配 |
| 无 MinIO | 新增 `minio` 与 `minio-init` |

### 11.2 目标 Compose 服务

```text
services:
  mysql:
    image: mysql:8.0
  redis:
    image: redis:7-alpine
  minio:
    image: minio/minio
  api:
    build: ./apps/api-go
  ai-service:
    build: ./apps/ai-service-python
  admin:
    build: ./apps/admin # 暂缓或后续适配
```

### 11.3 环境变量调整

| 旧变量 | 新变量 | 说明 |
|---|---|---|
| `DATABASE_URL=postgresql://...` | `MYSQL_DSN=...` 或 `DATABASE_URL=mysql://...` | 统一 MySQL 连接 |
| `REDIS_URL` | `REDIS_URL` | 保留 |
| `OPENAI_API_KEY` | `OPENAI_API_KEY` | 保留 |
| `AZURE_SPEECH_KEY` | `AZURE_SPEECH_KEY` | 保留或替换为第三方语音供应商 |
| `AZURE_SPEECH_REGION` | `AZURE_SPEECH_REGION` | 保留或替换 |
| `ENCRYPTION_KEY` | `ENCRYPTION_KEY` | 保留 |
| 无 | `MINIO_ENDPOINT` | 新增 |
| 无 | `MINIO_ACCESS_KEY` | 新增 |
| 无 | `MINIO_SECRET_KEY` | 新增 |
| 无 | `MINIO_BUCKET_AUDIO` | 新增 |

---

## 12. 数据迁移与回滚方案

### 12.1 离线迁移窗口

V1.0 推荐使用离线迁移窗口：

1. 发布维护公告。
2. 旧系统进入只读或维护模式。
3. 备份 PostgreSQL。
4. 执行数据迁移。
5. 验证 MySQL 数据。
6. 启动新系统。
7. 切换客户端 API 地址。
8. 观察核心指标。

### 12.2 备份策略

迁移前必须备份：

- PostgreSQL 全库 dump。
- Redis 关键数据快照。
- 上传音频或对象文件目录。
- 当前 `.env` 配置。
- 当前 Docker 镜像版本。

### 12.3 回滚策略

若迁移失败：

1. 停止新 Go API 与 Python AI Service。
2. 恢复旧 Docker Compose。
3. 恢复 PostgreSQL 服务。
4. 客户端 API 地址切回旧服务。
5. 分析迁移失败原因。
6. 修复后重新执行迁移演练。

### 12.4 不允许的迁移行为

- 不允许无备份直接删除 PostgreSQL 数据卷。
- 不允许在新旧系统同时写入不同主库。
- 不允许迁移未校验即切换生产流量。
- 不允许接口契约未冻结时推进客户端联调。

---

## 13. 测试验收方案

### 13.1 单元测试

| 模块 | 测试重点 |
|---|---|
| Flutter | 状态管理、网络层、缓存、页面 ViewModel |
| Go API | Service、Repository、JWT、错误码 |
| Python AI | Prompt 拼接、结构化解析、上下文管理 |
| 数据迁移 | 字段转换、数量校验、数据完整性 |

### 13.2 集成测试

- 用户注册登录。
- 学习档案初始化。
- 每日任务生成。
- 生词添加与复习。
- 错题写入。
- 写作批改。
- 口语录音上传与评测。
- 学习统计更新。

### 13.3 回归测试

需覆盖旧系统已有核心能力：

- 自适应测评。
- AI 定制阅读。
- AI 口语对话。
- AI 写作精批。
- 听力训练。
- 生词复习。
- 学习进度统计。

### 13.4 性能测试

| 场景 | 指标 |
|---|---|
| 登录接口 | P95 < 300ms |
| 普通业务查询 | P95 < 500ms |
| 每日任务生成 | P95 < 2s（不含慢模型场景） |
| 写作批改 | 支持异步任务或明确等待反馈 |
| 口语语音处理 | 支持上传大小限制、超时与异步处理 |

---

## 14. 迁移里程碑计划

### M0：迁移准备

- [ ] 冻结 Phase5 架构标准。
- [ ] 冻结 OpenAPI 接口契约。
- [ ] 梳理旧系统功能清单。
- [ ] 确定 MySQL 表结构。
- [ ] 确定数据迁移脚本方案。

### M1：新工程初始化

- [ ] 初始化 Flutter 工程。
- [ ] 初始化 Go Gin API 工程。
- [ ] 初始化 Python FastAPI AI Service 工程。
- [ ] 初始化 MySQL / MinIO / Redis Compose。
- [ ] 建立基础 CI 检查。

### M2：基础业务闭环

- [ ] 用户认证。
- [ ] 学习档案。
- [ ] 每日任务。
- [ ] 生词与错题。
- [ ] Flutter 首页与核心导航。

### M3：AI 核心能力

- [ ] AI Agent Prompt 管理。
- [ ] 用户长期记忆注入。
- [ ] Redis 上下文管理。
- [ ] 写作批改。
- [ ] 口语对话与纠音。

### M4：数据迁移演练

- [ ] PostgreSQL 导出。
- [ ] MySQL 导入。
- [ ] 数据一致性校验。
- [ ] 抽样用户验收。
- [ ] 回滚演练。

### M5：正式切换

- [ ] 进入维护窗口。
- [ ] 执行最终数据迁移。
- [ ] 切换 Docker Compose。
- [ ] 切换客户端 API 地址。
- [ ] 完成冒烟测试。
- [ ] 开启生产监控。

### M6：旧架构下线

- [ ] 归档旧 `apps/mobile`。
- [ ] 归档旧 `apps/api`。
- [ ] 归档旧 `apps/ai-service`。
- [ ] 归档旧 `packages/database`。
- [ ] 移除 PostgreSQL 服务与数据卷。
- [ ] 更新 README 与部署文档。

---

## 15. 风险清单与应对策略

| 风险 | 影响 | 应对策略 |
|---|---|---|
| 技术栈全量替换导致周期拉长 | 高 | 分里程碑迁移，先完成核心学习闭环 |
| PostgreSQL 到 MySQL 类型差异 | 高 | 提前设计字段映射与迁移脚本，多轮演练 |
| pgvector 能力丢失 | 中 | V1.0 若无强依赖可暂缓；后续可引入 Milvus / Qdrant / MySQL 向量能力 |
| Flutter 重写 UI 工作量大 | 高 | 先实现核心流程，非核心页面后置 |
| Go 与 Python 服务边界不清 | 中 | OpenAPI 契约固定，Go 负责业务，Python 负责 AI |
| AI 返回结构不稳定 | 中 | Pydantic Schema 校验 + 重试 + fallback |
| 语音链路延迟高 | 中 | 异步队列、上传限制、结果轮询或 WebSocket |
| 管理后台仍为 Next.js | 中 | 暂缓为独立工具；后续决定是否重写或继续适配 |
| 新旧系统数据不一致 | 高 | 迁移窗口内禁止双写，执行数量与抽样校验 |

---

## 16. 最终下线清单

迁移完成并稳定运行后，以下资产应下线或归档：

### 16.1 代码目录

- [ ] `apps/mobile`：旧 Expo React Native App。
- [ ] `apps/api`：旧 TypeScript Fastify API。
- [ ] `apps/ai-service`：旧 TypeScript Fastify AI Service。
- [ ] `packages/database`：旧 Drizzle PostgreSQL 数据库包。
- [ ] `packages/shared-types`：旧 TypeScript 共享类型包。
- [ ] `packages/cefr-utils`：迁移为 Dart / Go / Python 后归档。

### 16.2 配置文件

- [ ] `pnpm-workspace.yaml`：若仅剩管理后台，可调整或移除。
- [ ] `turbo.json`：若不再需要 TypeScript monorepo 构建，可移除。
- [ ] 根 `package.json`：仅保留文档、管理后台或工具脚本。
- [ ] PostgreSQL 相关环境变量。
- [ ] Drizzle 相关配置与迁移脚本。

### 16.3 基础设施

- [ ] PostgreSQL Docker 服务。
- [ ] PostgreSQL 数据卷。
- [ ] pgvector 扩展迁移脚本。
- [ ] Node.js API / AI Service Dockerfile。

---

## 结束语

本方案明确 EnglishiApp 从当前 TypeScript 架构全量迁移至 EasiTalk AI V1.0 目标架构的执行路径。迁移过程中必须坚持契约优先、数据优先、分阶段验收、可回滚四项原则，确保在不保留旧 TypeScript 架构的前提下，平稳完成 Flutter、Go Gin、MySQL、Python FastAPI 的整体替换。

