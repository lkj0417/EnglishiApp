-- EasiTalk AI V1.0 writing submission table
-- Stores user writing submissions and structured AI correction result.

USE easitalk;

CREATE TABLE IF NOT EXISTS writing_submission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  original_content LONGTEXT NOT NULL,
  corrected_content LONGTEXT NULL,
  correction_result JSON NULL,
  band_score DECIMAL(4,2) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'corrected',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_writing_user_time (user_id, created_at),
  KEY idx_writing_user_status (user_id, status),
  CONSTRAINT fk_writing_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

