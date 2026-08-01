	speakingRepo := repository.NewSpeakingRepository(db)
	speakingService := service.NewSpeakingService(speakingRepo, minioStorage, cfg.AIBaseURL)
	speakingController := controller.NewSpeakingController(speakingService)

	minioStorage, err := storage.NewMinIOStorage(
		cfg.MinIOEndpoint,
		cfg.MinIOPublicEndpoint,
		cfg.MinIOAccessKey,
		cfg.MinIOSecretKey,
		cfg.MinIOBucketAudio,
	)
	if err != nil {
		log.Fatalf("connect minio: %v", err)
	}

package main

import (
	"log"

	"github.com/easitalk/englishi-app/apps/api-go/internal/config"
	"github.com/easitalk/englishi-app/apps/api-go/internal/controller"
	"github.com/easitalk/englishi-app/apps/api-go/internal/repository"
	"github.com/easitalk/englishi-app/apps/api-go/internal/server"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/easitalk/englishi-app/apps/api-go/pkg/database"
	redisclient "github.com/easitalk/englishi-app/apps/api-go/pkg/redis"
	"github.com/easitalk/englishi-app/apps/api-go/pkg/storage"
	"github.com/easitalk/englishi-app/apps/api-go/pkg/storage"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	db, err := database.Connect(cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("connect mysql: %v", err)
	}

	redisClient, err := redisclient.Connect(cfg.RedisURL)
	if err != nil {
		log.Fatalf("connect redis: %v", err)
	}
	defer redisClient.Close()

	minioStorage, err := storage.NewMinIOStorage(
		cfg.MinIOEndpoint,
		cfg.MinIOPublicEndpoint,
		cfg.MinIOAccessKey,
		cfg.MinIOSecretKey,
		cfg.MinIOBucketAudio,
	)
	if err != nil {
		log.Fatalf("connect minio: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	authService := service.NewAuthService(userRepo, redisClient, cfg.JWTSecret, cfg.LoginStateTTL)
	authController := controller.NewAuthController(authService)

	profileRepo := repository.NewProfileRepository(db)
	profileService := service.NewProfileService(profileRepo)
	profileController := controller.NewProfileController(profileService)

	taskRepo := repository.NewDailyTaskRepository(db)
	taskService := service.NewDailyTaskService(taskRepo, cfg.AIBaseURL)
	taskController := controller.NewDailyTaskController(taskService)

	wordRepo := repository.NewWordRepository(db)
	wordService := service.NewWordService(wordRepo)
	wordController := controller.NewWordController(wordService)

	errorRecordRepo := repository.NewErrorRecordRepository(db)
	errorRecordService := service.NewErrorRecordService(errorRecordRepo)
	errorRecordController := controller.NewErrorRecordController(errorRecordService)

	writingRepo := repository.NewWritingRepository(db)
	writingService := service.NewWritingService(writingRepo, cfg.AIBaseURL)
	writingController := controller.NewWritingController(writingService)

	speakingRepo := repository.NewSpeakingRepository(db)
	speakingService := service.NewSpeakingService(speakingRepo, minioStorage, cfg.AIBaseURL)
	speakingController := controller.NewSpeakingController(speakingService)

	router := server.NewRouter(
		authController,
		profileController,
		taskController,
		wordController,
		errorRecordController,
		writingController,
		speakingController,
		speakingController,
		authService,
		cfg.JWTSecret,
	)
	log.Printf("EasiTalk Go API listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("run api: %v", err)
	}
}

