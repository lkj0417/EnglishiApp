-- EasiTalk AI V1.0 speaking and audio tables
-- Stores MinIO audio metadata and speaking practice sessions.

USE easitalk;

CREATE TABLE IF NOT EXISTS audio_asset (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  bucket VARCHAR(128) NOT NULL,
  object_key VARCHAR(512) NOT NULL,
  original_filename VARCHAR(255) NOT NULL DEFAULT '',
  mime_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  purpose VARCHAR(32) NOT NULL DEFAULT 'speaking_recording',
  public_url VARCHAR(1024) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_audio_object (bucket, object_key),
  KEY idx_audio_user_time (user_id, created_at),
  CONSTRAINT fk_audio_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS speaking_session (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  audio_asset_id BIGINT UNSIGNED NULL,
  user_text TEXT NULL,
  ai_reply TEXT NULL,
  pronunciation_result JSON NULL,
  tts_text TEXT NULL,
  tts_audio_url VARCHAR(1024) NULL,
  score DECIMAL(5,2) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_speaking_user_session (user_id, session_id),
  KEY idx_speaking_user_time (user_id, created_at),
  CONSTRAINT fk_speaking_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE,
  CONSTRAINT fk_speaking_audio FOREIGN KEY (audio_asset_id) REFERENCES audio_asset (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

