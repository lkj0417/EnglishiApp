-- 001_initial_schema.sql
-- 初始化数据库扩展和基础结构

-- 启用 pgvector 扩展（用于 embedding 相似度搜索）
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 为 generated_content 表添加 vector 列（3072维，text-embedding-3-large）
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS
  embedding vector(3072);

-- 为 embedding 建立 IVFFlat 索引（加速近似最近邻搜索）
CREATE INDEX IF NOT EXISTS idx_content_embedding
  ON generated_content USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 为 learning_events 创建月度分区（提升大数据量查询性能）
-- 注意：Drizzle 暂不支持自动分区，此处为补充 SQL

