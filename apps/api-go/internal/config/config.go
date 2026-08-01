package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port          string
	MySQLDSN      string
	RedisURL      string
	AIBaseURL     string
	JWTSecret     string
	LoginStateTTL time.Duration
	MinIOEndpoint string
	MinIOPublicEndpoint string
	MinIOAccessKey string
	MinIOSecretKey string
	MinIOBucketAudio string
	MinIOEndpoint string
	MinIOPublicEndpoint string
	MinIOAccessKey string
	MinIOSecretKey string
	MinIOBucketAudio string
}

func Load() Config {
	return Config{
		Port:          getEnv("API_PORT", getEnv("PORT", "3001")),
		MySQLDSN:      getEnv("MYSQL_DSN", "easitalk:easitalk_dev_password@tcp(localhost:3306)/easitalk?charset=utf8mb4&parseTime=True&loc=Local"),
		RedisURL:      getEnv("REDIS_URL", "redis://localhost:6379/0"),
		AIBaseURL:     getEnv("AI_SERVICE_URL", "http://localhost:3002"),
		JWTSecret:     getEnv("JWT_SECRET", "dev_jwt_secret_change_in_production"),
		LoginStateTTL: time.Duration(getEnvInt("LOGIN_STATE_TTL_SECONDS", 7*24*3600)) * time.Second,
		MinIOEndpoint: getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOPublicEndpoint: getEnv("MINIO_PUBLIC_ENDPOINT", "http://localhost:9000"),
		MinIOAccessKey: getEnv("MINIO_ACCESS_KEY", "easitalk_minio"),
		MinIOSecretKey: getEnv("MINIO_SECRET_KEY", "easitalk_minio_password"),
		MinIOBucketAudio: getEnv("MINIO_BUCKET_AUDIO", "easitalk-audio"),
		MinIOEndpoint: getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOPublicEndpoint: getEnv("MINIO_PUBLIC_ENDPOINT", "http://localhost:9000"),
		MinIOAccessKey: getEnv("MINIO_ACCESS_KEY", "easitalk_minio"),
		MinIOSecretKey: getEnv("MINIO_SECRET_KEY", "easitalk_minio_password"),
		MinIOBucketAudio: getEnv("MINIO_BUCKET_AUDIO", "easitalk-audio"),
	}
}

func getEnv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		parsed, err := strconv.Atoi(value)
		if err == nil && parsed > 0 {
			return parsed
		}
	}
	return fallback
}

