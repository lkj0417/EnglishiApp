# EnglishiApp — 完整部署与使用指南

> AI 原生自适应英语学习平台 · 从零基础到雅思 8 分

---

## 📋 目录

1. [项目概览](#1-项目概览)
2. [系统架构](#2-系统架构)
3. [环境准备](#3-环境准备)
   - [Windows 环境](#31-windows-环境)
   - [macOS 环境](#32-macos-环境)
   - [Linux 环境](#33-linux-环境)
4. [本地开发部署](#4-本地开发部署)
5. [生产环境部署](#5-生产环境部署)
6. [初始化与配置](#6-初始化与配置)
7. [管理员后台使用指南](#7-管理员后台使用指南)
8. [移动端使用指南](#8-移动端使用指南)
9. [常见问题排查](#9-常见问题排查)
10. [升级与维护](#10-升级与维护)
11. [附录](#附录)

---

## 1. 项目概览

### 核心功能

| 模块 | 说明 |
|------|------|
| 🧠 自适应评测（CAT） | 8分钟精准定位 CEFR 水平，精度 0.1 级 |
| 📖 AI 定制阅读 | 按用户水平+兴趣实时生成文章，词汇严格控制在 i+1 |
| 🎙️ AI 口语考官 | 雅思 Part 1/2/3 全流程模拟，WebSocket 实时对话 |
| ✍️ AI 写作精批 | TR/CC/LR/GRA 四维逐句批注，Band Score 预测 |
| 🎧 听力训练 | 按 CEFR 分级的自适应听力材料 |
| 📚 SM-2 词汇系统 | 科学间隔重复，三条件掌握判定 |
| ⚙️ 管理后台 | 多 AI 提供商配置、全局参数、Prompt 版本管理 |

### 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 后端 API | `3001` | 核心业务 REST API + WebSocket |
| AI Service | `3002` | AI 引擎 + BullMQ Workers |
| 管理后台 | `3003` | Next.js Web 管理界面 |
| PostgreSQL | `5432` | 主数据库（含 pgvector） |
| Redis | `6379` | 缓存 + 任务队列 |

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────┐
│  客户端                                                   │
│  iOS / Android (React Native)  ·  Web 管理后台 (Next.js) │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────▼──────────────────────────────────┐
│  后端 API  (Fastify · Node.js)  端口 3001                │
│  JWT 鉴权 · REST · WebSocket · 限流                      │
└──────┬────────────────────────────────┬─────────────────┘
       │ 读写                            │ BullMQ 任务队列
┌──────▼─────────┐              ┌────────▼────────────────┐
│  PostgreSQL 16  │              │  AI Service  端口 3002   │
│  + pgvector     │              │  动态提供商选择          │
│  Redis 7        │              │  OpenAI / DeepSeek /    │
└─────────────────┘              │  Gemini / Ollama...     │
                                 └─────────────────────────┘
```

---

## 3. 环境准备

### 必要软件版本

| 软件 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 18.x | **20.x LTS** |
| pnpm | 8.x | **9.x** |
| Docker | 20.x | **24.x+** |
| Docker Compose | 2.x | **2.20+** |
| Git | 2.x | 任意新版 |

---

### 3.1 Windows 环境

#### 步骤一：安装 Node.js

**方法 A（推荐）：使用 nvm-windows**

1. 下载 [nvm-windows](https://github.com/coreybutler/nvm-windows/releases/latest)，双击 `nvm-setup.exe` 安装
2. 以**管理员身份**重新打开 PowerShell

```powershell
# 安装 Node.js 20 LTS
nvm install 20
nvm use 20

# 验证
node --version   # 应显示 v20.x.x
npm --version    # 应显示 10.x.x
```

**方法 B：直接安装**

访问 https://nodejs.org 下载 **20.x LTS** 安装包，双击运行（勾选"自动安装必要工具"）。

#### 步骤二：安装 pnpm

```powershell
# 以管理员身份运行 PowerShell
npm install -g pnpm

# 验证
pnpm --version   # 应显示 9.x.x
```

#### 步骤三：安装 Docker Desktop

1. 下载 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. 双击安装，**重启电脑**
3. 启动 Docker Desktop，等待系统托盘图标变绿

```powershell
# 验证（在新 PowerShell 中运行）
docker --version          # Docker version 24.x.x
docker compose version    # Docker Compose version v2.x.x
```

> ⚠️ **注意事项**：
> - 需要 WSL2 支持：如提示未安装，运行 `wsl --install` 后重启
> - 企业电脑可能需要 IT 管理员权限
> - 建议在 Docker Desktop 设置中将内存上限调为 **4GB+**

#### 步骤四：安装 Git

1. 下载 [Git for Windows](https://git-scm.com/download/win)
2. 安装时选择 "Git from the command line and also from 3rd-party software"
3. 验证：`git --version`

---

### 3.2 macOS 环境

#### 步骤一：安装 Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Apple Silicon (M1/M2/M3) 额外执行：
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

#### 步骤二：安装 Node.js

```bash
# 安装 nvm（Node 版本管理器）
brew install nvm

# 加入 shell 配置
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
source ~/.zshrc

# 安装 Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# 验证
node --version   # v20.x.x
```

#### 步骤三：安装 pnpm

```bash
npm install -g pnpm
pnpm --version   # 9.x.x
```

#### 步骤四：安装 Docker Desktop

```bash
brew install --cask docker
# 然后在 Launchpad 启动 Docker.app，等待菜单栏图标变绿
```

或直接从 [docker.com](https://www.docker.com/products/docker-desktop/) 下载 `.dmg` 安装。

```bash
# 验证
docker --version
docker compose version
```

---

### 3.3 Linux 环境

以 **Ubuntu 22.04 LTS / Debian 12** 为例：

#### 步骤一：安装 Node.js

```bash
# 使用 NodeSource 官方源（推荐）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证
node --version   # v20.x.x
npm --version    # 10.x.x
```

**CentOS / RHEL / Rocky Linux：**

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

#### 步骤二：安装 pnpm

```bash
npm install -g pnpm
# 或官方安装脚本：
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

pnpm --version
```

#### 步骤三：安装 Docker + Docker Compose

```bash
# 卸载旧版本（如有）
sudo apt-get remove docker docker-engine docker.io containerd runc 2>/dev/null

# 安装依赖
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# 添加 Docker 官方 GPG Key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 添加 Docker 软件源
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine + Compose 插件
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 允许当前用户使用 Docker（免 sudo）
sudo usermod -aG docker $USER
newgrp docker

# 验证
docker --version
docker compose version

# 设置开机自启
sudo systemctl enable docker
sudo systemctl start docker
```

---

## 4. 本地开发部署

### 4.1 获取代码

```bash
git clone https://github.com/your-org/englishi-app.git
cd englishi-app
```

### 4.2 配置环境变量

```bash
# 复制模板
cp .env.example .env
```

用编辑器打开 `.env`，按以下说明填写：

```dotenv
# ─────────────────────────────────────────────
# 数据库（Docker 默认配置，本地开发无需修改）
# ─────────────────────────────────────────────
DATABASE_URL=postgresql://englishi:englishi_dev_password@localhost:5432/englishi_db
REDIS_URL=redis://localhost:6379

# ─────────────────────────────────────────────
# AI 提供商（至少填一个，后续可在管理后台配置）
# ─────────────────────────────────────────────
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
# 其他可选（也可留空，在管理后台添加）：
# DEEPSEEK_API_KEY=sk-xxxxxxxx

# ─────────────────────────────────────────────
# 安全密钥（必须修改！）
# ─────────────────────────────────────────────
JWT_SECRET=请替换为至少64位随机字符串
ENCRYPTION_KEY=请替换为32位随机字符串!!  # 用于加密数据库中的 API Key

# ─────────────────────────────────────────────
# 管理员账户（首次 seed 时使用）
# ─────────────────────────────────────────────
ADMIN_EMAIL=admin@englishi.app
ADMIN_PASSWORD=Admin@123456          # 登录后请立即修改
ADMIN_SECRET=请替换为复杂字符串       # 注册管理员时需要提供的密钥

# ─────────────────────────────────────────────
# Azure 语音（可选，用于 TTS 和发音评估）
# ─────────────────────────────────────────────
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=eastasia

# ─────────────────────────────────────────────
# 服务地址（管理后台需要）
# ─────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001/v1
```

**生成随机密钥：**

```bash
# macOS / Linux
openssl rand -hex 32          # 生成 64 字符随机字符串
openssl rand -hex 16          # 生成 32 字符（ENCRYPTION_KEY 用）

# Windows PowerShell
[System.Web.Security.Membership]::GeneratePassword(64, 8)
# 或：
-join ((1..64) | ForEach { '{0:X}' -f (Get-Random -Max 16) })
```

### 4.3 启动数据库

```bash
# 启动 PostgreSQL（含 pgvector）和 Redis
docker compose up postgres redis -d

# 等待约 15 秒后检查状态
docker compose ps
```

期望输出（State 列显示 `healthy`）：
```
NAME                STATUS
englishi_postgres   running (healthy)
englishi_redis      running (healthy)
```

### 4.4 安装项目依赖

```bash
pnpm install
# 首次约需 3-5 分钟，后续更快
```

### 4.5 初始化数据库

```bash
# 第一步：推送 Schema（创建所有数据表）
cd packages/database
npx drizzle-kit push
cd ../..

# 第二步：插入默认配置 + 创建超级管理员
pnpm db:seed
```

成功输出：
```
🌱 Seeding database...
✓ 26 default settings inserted
✓ Super admin created: admin@englishi.app
  Initial password: Admin@123456 (please change immediately!)

✅ Database seeding completed!
```

### 4.6 启动服务

**开四个终端窗口分别运行：**

```bash
# 终端 1：后端 API（端口 3001）
pnpm --filter @englishi/api dev

# 终端 2：AI 服务 Workers（端口 3002）
pnpm --filter @englishi/ai-service dev

# 终端 3：管理后台（端口 3003）
pnpm --filter @englishi/admin dev

# 终端 4：移动端 Expo
pnpm --filter @englishi/mobile start
```

**验证启动成功：**

```bash
# 检查 API 健康状态
curl http://localhost:3001/health
# 返回：{"status":"ok","version":"1.0.0"}

# 管理后台
# 浏览器访问：http://localhost:3003
```

---

## 5. 生产环境部署

### 5.1 服务器准备

**最低配置建议：**

| 场景 | CPU | 内存 | 硬盘 | 带宽 |
|------|-----|------|------|------|
| 测试/小型（<50用户）| 2核 | 4GB | 40GB SSD | 5Mbps |
| 正式运营（50-500用户）| 4核 | 8GB | 100GB SSD | 20Mbps |
| 中大型（500+用户）| 8核+ | 16GB+ | 500GB SSD | 100Mbps |

推荐云服务商：
- **国内**：阿里云 ECS、腾讯云 CVM、华为云 ECS
- **海外**：AWS EC2 (t3.medium+)、GCP e2-standard-2+、Hetzner

### 5.2 Docker Compose 一键部署

```bash
# 1. 克隆代码
git clone https://github.com/your-org/englishi-app.git
cd englishi-app

# 2. 生产环境配置（修改所有默认密码和密钥！）
cp .env.example .env
nano .env   # 或 vim .env

# 3. 启动全部服务（含构建）
docker compose up -d --build

# 4. 查看启动状态
docker compose ps
docker compose logs -f --tail=50

# 5. 初始化数据库（首次部署执行一次）
docker compose exec api pnpm --filter @englishi/database exec -- npx drizzle-kit push
docker compose exec api sh -c "cd packages/database && npx tsx src/seed.ts"
```

### 5.3 生产环境 .env 关键修改

```dotenv
NODE_ENV=production

# 生产数据库（建议使用云数据库服务，如阿里云 RDS）
DATABASE_URL=postgresql://prod_user:strong_password@your-db-host:5432/englishi_prod

# 生产 Redis（建议使用云 Redis，如阿里云 Redis）
REDIS_URL=redis://:your_redis_password@your-redis-host:6379

# 全部使用强随机密钥（每个项目独立生成，不得共用）
JWT_SECRET=<64位以上完全随机字符串>
ENCRYPTION_KEY=<32位完全随机字符串>
ADMIN_PASSWORD=<包含大小写+数字+特殊字符的强密码>
ADMIN_SECRET=<30位以上随机字符串>
```

### 5.4 Nginx 反向代理（HTTPS）

```bash
# 安装 Nginx 和 Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/englishi
```

```nginx
# API 服务（含 WebSocket 支持）
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;    # WebSocket
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }
}

# 管理后台
server {
    listen 80;
    server_name admin.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# 启用配置并申请 SSL 证书
sudo ln -s /etc/nginx/sites-available/englishi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 自动申请 Let's Encrypt 证书（免费 HTTPS）
sudo certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com

# 设置证书自动续期
sudo crontab -e
# 添加：0 0 * * * certbot renew --quiet
```

### 5.5 进程守护（生产环境推荐）

使用 Docker 的 restart 策略（已在 docker-compose.yml 中配置）：

```bash
# 查看所有容器状态
docker compose ps

# 若某个容器异常退出，自动重启
# 在 docker-compose.yml 中各服务下已有：
# restart: unless-stopped
```

---

## 6. 初始化与配置

### 6.1 首次启动检查清单

```
[ ] 第1步：确认所有服务健康
    curl http://localhost:3001/health → {"status":"ok"}

[ ] 第2步：访问管理后台
    浏览器打开 http://localhost:3003（或 https://admin.yourdomain.com）

[ ] 第3步：用管理员账号登录
    邮箱：.env 中 ADMIN_EMAIL
    密码：.env 中 ADMIN_PASSWORD

[ ] 第4步：配置 AI 提供商（必须）
    → AI 提供商页 → 添加至少1个「高质量层」+ 1个「高速层」提供商
    → 点击「测试连接」确认 Key 有效

[ ] 第5步：修改管理员密码
    → 用户管理页或通过 API 修改

[ ] 第6步：调整全局配置（可选）
    → 全局配置页，检查教学参数是否符合需求
```

### 6.2 AI 提供商配置详解

登录管理后台 → **「AI 提供商管理」** → 点击「+ 添加提供商」

#### OpenAI 配置示例

| 字段 | 值 |
|------|---|
| 提供商类型 | OpenAI |
| 显示名称 | GPT-4o 高质量层 |
| API Base URL | 留空（自动使用 https://api.openai.com/v1） |
| API Key | `sk-xxxx...`（从 platform.openai.com 获取）|
| 模型 ID | `gpt-4o` |
| 任务层级 | **高质量层**（写作精批、口语报告）|
| 设为默认 | ✅ |

#### DeepSeek 配置示例（推荐高速层，性价比极高）

| 字段 | 值 |
|------|---|
| 提供商类型 | DeepSeek |
| 显示名称 | DeepSeek Chat 高速层 |
| API Base URL | 留空 |
| API Key | `sk-xxxx...`（从 platform.deepseek.com 获取）|
| 模型 ID | `deepseek-chat` |
| 任务层级 | **高速层**（阅读生成、词汇、语法）|
| 设为默认 | ✅ |

#### New API / One API 中转配置

如果你使用 One API、New API 等聚合中转服务：

| 字段 | 值 |
|------|---|
| 提供商类型 | New API / One API |
| API Base URL | `https://your-oneapi.com/v1` |
| API Key | 你的令牌 |
| 模型 ID | 通过中转访问的具体模型名 |

#### 本地 Ollama 配置（无需网络，完全私有）

```bash
# 先在本机安装 Ollama
# macOS / Linux:
curl -fsSL https://ollama.ai/install.sh | sh
# Windows: 访问 https://ollama.ai 下载安装包

# 拉取模型（选一个）
ollama pull qwen2.5:7b     # 推荐中文能力强
ollama pull mistral:7b
ollama pull llama3.1:8b
```

管理后台配置：

| 字段 | 值 |
|------|---|
| 提供商类型 | Ollama（本地）|
| API Base URL | `http://localhost:11434/v1` |
| API Key | `ollama`（随意，Ollama 不校验）|
| 模型 ID | `qwen2.5:7b` |

---

## 7. 管理员后台使用指南

### 7.1 页面功能总览

| 页面 | 路径 | 主要功能 |
|------|------|---------|
| 概览仪表盘 | `/dashboard` | 实时统计、错误日志、Token 消耗图表 |
| AI 提供商 | `/dashboard/providers` | 增删改查提供商、测试连接、切换默认 |
| 全局配置 | `/dashboard/settings` | 26个教学/AI/系统参数的实时配置 |
| Prompt 管理 | `/dashboard/prompts` | Prompt 版本库、一键切换生产版本 |
| 用户管理 | `/dashboard/users` | 用户列表、角色权限分配 |

### 7.2 概览仪表盘

- **4个统计卡片**：用户总数、活跃提供商数、今日 API 调用量、今日平均延迟
- **提供商排行**：按调用次数排序，显示累计 Token 消耗
- **7天调用统计表**：按日期+任务类型展示调用量、输入/输出 Token、错误数
- **最近错误**：显示最近 5 条 API 调用失败记录（便于快速排查）

### 7.3 AI 提供商管理（核心功能）

**添加流程：**
1. 点击「+ 添加提供商」
2. 选择提供商类型（系统自动填充默认 URL 和模型列表）
3. 填写 API Key（加密存储，界面只显示末4位）
4. 选择任务层级：高质量层（复杂任务）或高速层（高频任务）
5. 勾选「设为该层默认」
6. 保存后点击**「测试连接」**确认可用

**切换提供商（零停机）：**
- 新提供商测试通过 → 勾选「设为默认」→ 保存
- 无需重启任何服务，下次 AI 调用立即生效

**提供商卡片显示：**
- 🟢 绿点 = 已启用，⚪ 灰点 = 已停用
- `默认` 蓝色标签 = 当前该层的默认提供商
- 总调用次数 / 累计输入输出 Token / 最近使用时间
- 「停用」按钮 = 软删除（不删除数据，可重新启用）

### 7.4 全局配置

所有参数修改后**即时生效，无需重启**。

**教学质量关键参数：**

| 参数键 | 说明 | 默认值 | 建议范围 |
|--------|------|--------|---------|
| `target_new_word_rate` | 阅读文章生词率（i+1 密度）| 0.06 | 0.04-0.08 |
| `gate_review_pass_threshold` | 关卡测验通过线 | 0.70 | 0.65-0.80 |
| `vocab_mastered_choice_streak` | 词汇掌握所需连续正确次数 | 3 | 2-5 |
| `grammar_mastered_streak` | 语法掌握所需连续正确次数 | 4 | 3-6 |
| `daily_task_max_minutes` | 每日任务最大时长（分钟）| 90 | 45-120 |
| `cat_initial_difficulty` | 测评初始难度（CEFR 数值）| 3.0 | 2.0-4.0 |

**系统控制参数：**

| 参数键 | 说明 | 建议 |
|--------|------|------|
| `maintenance_mode` | 维护模式（true/false）| 更新时临时开启 |
| `new_user_registration` | 是否允许新注册 | 内测时可关闭 |
| `max_daily_ai_calls_per_user` | 每用户每日 AI 调用上限 | 0=不限，100=推荐 |

### 7.5 Prompt 模板管理

**工作流程：**
```
1. 点击「+ 新建模板版本」
2. 选择引擎（ReadingEngine/WritingCritic 等）
3. 填写 System Prompt 和 User Prompt 模板
4. 保存为草稿（不影响生产）
5. 通过内部测试确认效果后
6. 点击「设为生产版本」一键切换
   → 旧版本自动降为历史记录（可随时回滚）
```

**6个引擎说明：**

| 引擎 | 用途 | 推荐层级 |
|------|------|---------|
| ReadingEngine | 生成定制阅读文章 + 配套题目 | 高速 |
| ListeningEngine | 生成听力脚本 | 高速 |
| SpeakingExaminer | AI 口语考官 + 事后报告 | 高质量 |
| WritingCritic | 写作逐句精批 + 改写示范 | 高质量 |
| VocabEngine | 情景化词汇解析 + 例句 | 高速 |
| GrammarEngine | 语法讲解 + 练习题生成 | 高速 |

### 7.6 用户管理

- 分页浏览所有用户（姓名/邮箱/角色/注册时间/最近活跃）
- 通过下拉菜单直接修改角色
- 按角色筛选（学员/管理员/超级管理员）

**角色权限对比：**

| 权限 | student | admin | super_admin |
|------|---------|-------|-------------|
| 使用 App 学习功能 | ✅ | ✅ | ✅ |
| 访问管理后台 | ❌ | ✅ | ✅ |
| 修改 AI 提供商 | ❌ | ✅ | ✅ |
| 修改全局配置 | ❌ | ✅ | ✅ |
| 管理 Prompt 模板 | ❌ | ✅ | ✅ |
| 修改用户角色 | ❌ | ✅（仅到admin）| ✅（所有角色）|

---

## 8. 移动端使用指南

### 8.1 连接方式

**方式 A：Expo Go（最快，用于开发测试）**

1. 手机安装 Expo Go（App Store / Google Play 搜索 "Expo Go"）
2. 确保手机与电脑连接同一 Wi-Fi
3. 运行 `pnpm --filter @englishi/mobile start`
4. 用 Expo Go 扫描终端中显示的二维码

**方式 B：Android 模拟器**

```bash
# 确保已安装 Android Studio 和 AVD
# 启动模拟器后运行：
pnpm --filter @englishi/mobile start
# 按 a 键，自动在模拟器中打开
```

**方式 C：iOS 模拟器（仅 macOS）**

```bash
# 确保已安装 Xcode
pnpm --filter @englishi/mobile start
# 按 i 键，自动在 iOS 模拟器中打开
```

### 8.2 完整用户流程

```
① 注册账号
   → 打开 App → 「没有账号？免费注册」
   → 填写邮箱 / 密码（≥8位）/ 昵称

② 引导设置（约 2 分钟）
   → 选择兴趣领域（最多5个）
   → 设置雅思目标分数
   → 承诺每日学习时长

③ 入门测评（约 8 分钟）
   → 系统出约 20 道自适应题目
   → 完成后展示 CEFR 六维雷达图 + 雅思预测分

④ 每日学习循环
   → 今日任务包（词汇复习→语法→阅读→听力→口语或写作）
   → 每10个单元触发关卡测验（Gate Review）
   → 每周生成学习报告
```

### 8.3 各模块详细操作

#### 📖 AI 定制阅读

```
1. 点击「AI 定制阅读」任务
2. 等待约 5-10 秒（AI 生成专属文章）
3. 阅读时：
   - 点击蓝色下划线词汇 → 查看解释+例句+词根
   - 点击「+ 加入词汇本」→ 加入 SM-2 复习队列
4. 回答理解题（判断/推断/主旨/词义）
5. 查看解析，了解错误原因
```

#### 🎙️ AI 口语对练

```
1. 点击「AI 口语对练」→ 选择模式
   - Part 1：个人话题问答（3-5 题，各 15-40 秒）
   - Part 2：1 分钟准备 + 1-2 分钟独白
   - Part 3：抽象话题深度讨论（AI 动态追问）
2. 开始 → AI 考官提问 → 按住录音按钮说话
3. 松开 → 点击「完成回答」→ 进入下一题
4. 全部完成 → 等待 20-30 秒生成报告
5. 查看报告：
   - 四维 Band Score（FC/LR/GRA/PR）
   - 原话标注（填充词/词汇/语法问题）
   - Band 7.5 改写示范
```

> ⚠️ **重要**：录音期间 AI 不会打断，所有反馈在结束后集中展示

#### ✍️ AI 写作批改

```
1. 点击「写作任务」→ 阅读题目
2. 在文本框中写作（注意最低字数要求）
3. 点击「提交 · AI 精批」
4. 等待 20-40 秒（AI 逐句分析）
5. 查看报告三个 Tab：
   - 「详细分析」：段落结构 + 最高优先级改进 + 亮点
   - 「逐句批注」：五色标注（🔴语法/🟡词汇/🔵逻辑/🟠偏题/🟢亮点）
   - 「AI 改写」：Band 7.5 版本 + 每处改动说明
```

#### 📚 词汇 SM-2 复习

```
1. 点击「词汇复习」→ 显示待复习单词
2. 先尝试回忆含义 → 点「查看答案」
3. 根据记忆质量选择：
   - 完全忘了（质量1）→ 间隔重置为1天
   - 模糊记得（质量3）→ 间隔不变
   - 记住了（质量4）→ 间隔乘以记忆系数
   - 非常熟悉（质量5）→ 间隔大幅增加
4. 每个词独立追踪复习时间（SM-2 算法）
```

#### 📊 进度查看

```
进度 Tab → 查看：
- 六维能力雷达图（词汇/语法/阅读/听力/口语/写作）
- 雅思预测分（当前 → 目标）
- 达标里程碑时间线
- 词汇本统计（学习中/复习中/已掌握）
```

---

## 9. 常见问题排查

### Q1：Docker 容器启动失败 "port already in use"

```bash
# macOS / Linux — 查找占用端口的进程
lsof -i :5432   # PostgreSQL
lsof -i :6379   # Redis
lsof -i :3001   # API

# Windows PowerShell
netstat -ano | findstr "5432"
# 找到 PID 后：taskkill /PID <pid> /F

# 解决方案：停止冲突进程 或 修改 docker-compose.yml 端口映射
# 例：将 "5432:5432" 改为 "5433:5432"，并同步修改 .env 中的 DATABASE_URL
```

### Q2：`pnpm db:seed` 失败 "relation does not exist"

```bash
# 数据表未创建，先推送 Schema
cd packages/database
npx drizzle-kit push
cd ../..

# 然后重新运行
pnpm db:seed
```

### Q3：管理后台登录报 "账号无管理员权限"

```bash
# 方法一：通过数据库直接修改角色
docker compose exec postgres psql -U englishi -d englishi_db -c \
  "UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';"

# 方法二：重新运行 seed（会检查并创建管理员账户）
pnpm db:seed
```

### Q4：AI 内容生成失败 / 返回 500

```bash
# 1. 检查 AI Service 是否运行
curl http://localhost:3002/health

# 2. 登录管理后台 → AI 提供商 → 点击「测试连接」
# 若失败：检查 API Key 是否有效、余额是否充足

# 3. 检查 Redis 队列
docker compose exec redis redis-cli llen bull:reading-generate:waiting

# 4. 查看 Worker 日志
pnpm --filter @englishi/ai-service dev
```

### Q5：Windows 下 pnpm 命令报错 "execution policy"

```powershell
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# 然后重新尝试 pnpm 命令
```

### Q6：移动端无法连接 API "Network request failed"

```bash
# 确认 API 服务在运行
curl http://localhost:3001/health

# 移动端 .env 检查
# apps/mobile/.env 中的 EXPO_PUBLIC_API_URL 必须是局域网 IP，不能是 localhost
# 例：EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/v1

# 查看本机局域网 IP：
# macOS: ifconfig | grep "inet " | grep -v 127.0.0.1
# Linux: ip addr show | grep "inet " | grep -v 127
# Windows PowerShell: (Get-NetIPAddress -AddressFamily IPv4).IPAddress
```

### Q7：Docker 内存不足 / 容器反复重启

```bash
# 检查内存使用
docker stats

# Docker Desktop → Settings → Resources → Memory
# 建议设置为 4GB+（8GB 最佳）

# 或减少并发 Worker 数量
# 编辑 apps/ai-service/src/server.ts 中 concurrency 参数
```

### Q8：生产环境 HTTPS WebSocket 无法连接

```nginx
# Nginx 配置中需要正确处理 WebSocket 升级
location /v1/speaking/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;
}
```

移动端 `apps/mobile/src/lib/api.ts` 中：
```typescript
// 生产环境使用 wss:// 而不是 ws://
const WS_BASE = process.env['EXPO_PUBLIC_WS_URL'] ?? 'wss://api.yourdomain.com';
```

---

## 10. 升级与维护

### 10.1 更新代码

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 更新依赖
pnpm install

# 3. 若有 Schema 变更（查看 CHANGELOG.md 确认）
cd packages/database && npx drizzle-kit push && cd ../..

# 4. 重启服务
# 开发环境：重启各终端即可
# 生产环境（Docker）：
docker compose up -d --build --force-recreate
```

### 10.2 数据库备份与恢复

```bash
# 备份（建议每日自动执行）
docker compose exec postgres pg_dump -U englishi englishi_db \
  | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# 恢复
gunzip -c backup_20260626_120000.sql.gz | \
  docker compose exec -T postgres psql -U englishi -d englishi_db

# 设置定时备份（Linux crontab）
crontab -e
# 添加（每天凌晨2点备份）：
# 0 2 * * * cd /path/to/englishi-app && docker compose exec postgres pg_dump -U englishi englishi_db | gzip > /backup/englishi_$(date +\%Y\%m\%d).sql.gz
```

### 10.3 查看运行日志

```bash
# 实时日志（全部服务）
docker compose logs -f

# 单独查看某服务（最近200行）
docker compose logs --tail=200 -f api
docker compose logs --tail=200 -f ai-service

# 搜索错误
docker compose logs api 2>&1 | grep -i "error"

# 导出日志文件
docker compose logs api > api_$(date +%Y%m%d).log
```

### 10.4 API 成本监控

登录管理后台 → **概览仪表盘** 查看：

- 今日/7天 Token 消耗趋势
- 各提供商的累计调用量和 Token 消耗
- 错误率统计（便于发现 Key 失效等问题）

**成本优化建议：**

| 任务类型 | 推荐提供商 | 理由 |
|---------|---------|------|
| 阅读文章生成（高频）| DeepSeek Chat / Gemini Flash | 低成本，质量够用 |
| 词汇解析（极高频）| DeepSeek Chat | 最低成本 |
| 语法讲解（高频）| DeepSeek Chat | 结构化输出稳定 |
| 写作精批（中频）| GPT-4o / Claude 3.5 | 需要深度推理 |
| 口语报告（中频）| GPT-4o / Claude 3.5 | 需要准确评分 |

---

## 附录

### 附录 A：完整数据库表说明

| 表名 | 用途 | 重要字段 |
|------|------|---------|
| `users` | 用户基础信息 | `role`（student/admin/super_admin）|
| `user_ability_models` | 当前 CEFR 能力模型 | `overall_cefr`、`weak_areas`、`error_patterns` |
| `ability_model_snapshots` | 每日能力快照 | 用于绘制进步曲线 |
| `learning_events` | 每次学习行为流水 | `performance_score`、`errors_made`、`ucl_after` |
| `vocabulary_items` | 词汇掌握状态 | `ease_factor`、`interval_days`、`due_date`（SM-2）|
| `grammar_items` | 语法点掌握状态机 | `status`（not_started→mastered）|
| `daily_packs` | 每日任务包 | `tasks`（JSON）、`difficulty_params` |
| `generated_content` | AI 生成内容缓存 | `embedding`（pgvector 去重）|
| `speaking_sessions` | 口语会话记录 | `transcript`、`feedback_report` |
| `writing_tasks` | 写作任务+批改报告 | `critique_report`（完整 JSON）|
| `assessment_sessions` | CAT 测评会话 | `answers`（含每题难度和正误）|
| `ai_providers` | AI 提供商配置 | `api_key`（AES-256 加密）、`tier`、`is_default` |
| `app_settings` | 全局配置参数 | `key`、`value`、`value_type` |
| `api_usage_logs` | API 调用明细 | `tokens_in/out`、`latency_ms`、`success` |
| `prompt_templates` | Prompt 版本库 | `is_current`（当前生产版本）|

### 附录 B：环境变量完整说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串 |
| `REDIS_URL` | ✅ | Redis 连接字符串 |
| `JWT_SECRET` | ✅ | JWT 签名密钥（≥32字符）|
| `ENCRYPTION_KEY` | ✅ | API Key 加密密钥（**必须为32字符**）|
| `ADMIN_EMAIL` | ✅ | 超级管理员邮箱（seed 时使用）|
| `ADMIN_PASSWORD` | ✅ | 超级管理员初始密码 |
| `ADMIN_SECRET` | ✅ | 注册管理员时需要提供的密钥 |
| `OPENAI_API_KEY` | 可选 | 数据库无配置时的回退 Key |
| `AZURE_SPEECH_KEY` | 可选 | Azure 语音服务（TTS/发音评估）|
| `AZURE_SPEECH_REGION` | 可选 | Azure 区域（如 eastasia）|
| `NEXT_PUBLIC_API_URL` | ✅ | 管理后台连接的 API 地址 |
| `NODE_ENV` | 可选 | `development` 或 `production` |

### 附录 C：常用管理命令速查

```bash
# ── 服务管理 ──────────────────────────────────────────
# 启动全部
docker compose up -d

# 停止全部
docker compose down

# 重启单个服务
docker compose restart api

# 查看状态
docker compose ps

# ── 数据库 ────────────────────────────────────────────
# 连接数据库
docker compose exec postgres psql -U englishi -d englishi_db

# 备份
docker compose exec postgres pg_dump -U englishi englishi_db > backup.sql

# 初始化（首次）
cd packages/database && npx drizzle-kit push && cd ../..
pnpm db:seed

# ── 日志 ──────────────────────────────────────────────
docker compose logs -f api           # 实时 API 日志
docker compose logs -f ai-service    # 实时 AI 日志
docker compose logs --tail=100 api   # 最近100行

# ── 用户角色管理 ──────────────────────────────────────
# 提升用户为管理员
docker compose exec postgres psql -U englishi -d englishi_db -c \
  "UPDATE users SET role='admin' WHERE email='user@example.com';"

# ── 缓存清理 ──────────────────────────────────────────
docker compose exec redis redis-cli flushdb   # 清除 Redis 缓存（谨慎！）
```

---

### 附录 D：v1.1 优化记录

本次迭代修复了若干影响「自适应」核心闭环与部署一致性的问题：

| 类别 | 优化内容 |
|------|---------|
| 🧠 自适应闭环 | **新增「静默能力模型更新引擎」**（`@englishi/database` 的 `updateAbilityAfterEvent`）。每完成一次阅读/听力/词汇/语法/写作/口语单元，按 PRD §1.3.1 公式 `new = old×0.85 + perf×target×0.15` 微调对应维度 CEFR，重算综合分与雅思预测分，并 **写入当日能力快照**。此前能力模型在测评后永不更新、进度曲线为平线的问题已解决。 |
| 📈 学习事件 | 阅读/听力/语法事件回填 `ucl_before / ucl_after`；写作、口语 Worker 现也写入 `learning_events`（含 AI Band），周报与 Gate Review 单元计数更准确。 |
| 🐳 部署一致性 | **修复 Docker 下 AI 服务缺失 Worker 的严重问题**：`ai-service` 容器原先只跑 `workers.ts`（仅 3 个 Worker、无 HTTP），导致语法/听力生成与 `/vocab/explain`、`/speaking/follow-up`、`/health` 在容器中失效。现统一由 `server.ts` 启动全部 5 个 Worker + HTTP，本地与容器行为一致，并加入优雅关闭与容器健康检查。 |
| 🔐 安全 | 修复用户角色越权：普通 `admin` 不能再授予/修改 `super_admin`，并防止降级最后一个超级管理员。 |
| ⚙️ 配置生效 | `maintenance_mode`（维护模式）与 `new_user_registration`（开放注册）开关现在真正在运行时生效（带 30s 缓存，管理员修改后即时失效）。 |
| 🐛 其它 | 写作历史按提交时间倒序返回；移除冗余的 `dev:workers` 脚本与重复 Worker 定义。 |

> 升级后请执行 `pnpm install`（已调整 workspace 依赖）。数据库结构未变更，无需重新迁移；能力快照将从升级后第一次学习开始累积。

---

*文档版本：v1.1 | 更新日期：2026-06-26*  
*如遇问题，请提交 GitHub Issue 或联系维护团队。*
