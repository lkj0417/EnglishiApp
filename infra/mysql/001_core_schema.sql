-- EasiTalk AI V1.0 core MySQL schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS easitalk
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE easitalk;

CREATE TABLE IF NOT EXISTS `user` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone VARCHAR(32) NULL,
  email VARCHAR(128) NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(64) NOT NULL DEFAULT '',
  avatar_url VARCHAR(512) NULL,
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1=active, 0=disabled',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_phone (phone),
  UNIQUE KEY uk_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_learning_profile (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  cefr_level VARCHAR(16) NOT NULL DEFAULT 'A1',
  learning_goal VARCHAR(255) NOT NULL DEFAULT '',
  daily_minutes INT NOT NULL DEFAULT 20,
  pain_points JSON NULL,
  material_preferences JSON NULL,
  weak_grammar_points JSON NULL,
  error_prone_words JSON NULL,
  speaking_weaknesses JSON NULL,
  writing_weaknesses JSON NULL,
  latest_assessment_at DATETIME(3) NULL,
  ability_scores JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_profile_user_id (user_id),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_word (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  word VARCHAR(128) NOT NULL,
  meaning VARCHAR(512) NOT NULL DEFAULT '',
  example_sentence TEXT NULL,
  mastery_level INT NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  next_review_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_word_user_next_review (user_id, next_review_at),
  UNIQUE KEY uk_word_user_word (user_id, word),
  CONSTRAINT fk_word_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_error_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  source_type VARCHAR(32) NOT NULL COMMENT 'speaking/writing/quiz/chat',
  original_content TEXT NOT NULL,
  corrected_content TEXT NULL,
  error_type VARCHAR(64) NOT NULL DEFAULT '',
  explanation TEXT NULL,
  knowledge_points JSON NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_error_user_type_time (user_id, source_type, occurred_at),
  CONSTRAINT fk_error_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_daily_task (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  task_date DATE NOT NULL,
  task_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  payload JSON NULL,
  estimated_minutes INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_task_user_date_status (user_id, task_date, status),
  CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_chat_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  chat_type VARCHAR(32) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  knowledge_summary JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_chat_user_session_time (user_id, session_id, created_at),
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_setting (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  accent VARCHAR(16) NOT NULL DEFAULT 'american',
  speech_rate DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  learning_difficulty VARCHAR(32) NOT NULL DEFAULT 'adaptive',
  notification_settings JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_setting_user_id (user_id),
  CONSTRAINT fk_setting_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prompt_version (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prompt_key VARCHAR(128) NOT NULL,
  version VARCHAR(32) NOT NULL,
  content LONGTEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_prompt_key_version (prompt_key, version),
  KEY idx_prompt_active (prompt_key, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dev seed user for local smoke tests. Password hash is placeholder; auth will replace it later.
INSERT INTO `user` (id, email, password_hash, nickname)
VALUES (1, 'demo@easitalk.local', 'dev-placeholder-hash', 'Demo Learner')
ON DUPLICATE KEY UPDATE nickname = VALUES(nickname);

INSERT INTO user_learning_profile (
  user_id,
  cefr_level,
  learning_goal,
  daily_minutes,
  pain_points,
  material_preferences,
  weak_grammar_points,
  error_prone_words,
  speaking_weaknesses,
  writing_weaknesses,
  ability_scores
) VALUES (
  1,
  'A2',
  '口语提升',
  20,
  JSON_ARRAY('表达卡顿', '语法易错'),
  JSON_ARRAY('日常生活', '旅行'),
  JSON_ARRAY('一般过去时', '冠词'),
  JSON_ARRAY('affect/effect'),
  JSON_ARRAY('连读', '重音'),
  JSON_ARRAY('中式表达', '句式单一'),
  JSON_OBJECT('listening', 2.0, 'speaking', 2.2, 'reading', 2.4, 'writing', 2.1)
) ON DUPLICATE KEY UPDATE
  cefr_level = VALUES(cefr_level),
  learning_goal = VALUES(learning_goal),
  updated_at = CURRENT_TIMESTAMP(3);

INSERT INTO user_setting (user_id, accent, speech_rate, learning_difficulty)
VALUES (1, 'american', 1.00, 'adaptive')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP(3);

