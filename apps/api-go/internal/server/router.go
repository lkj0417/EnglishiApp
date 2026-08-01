package server

import (
	"net/http"
	"time"

	"github.com/easitalk/englishi-app/apps/api-go/internal/controller"
	"github.com/easitalk/englishi-app/apps/api-go/internal/response"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/gin-gonic/gin"
)

func NewRouter(
	authController *controller.AuthController,
	profileController *controller.ProfileController,
	taskController *controller.DailyTaskController,
	wordController *controller.WordController,
	errorRecordController *controller.ErrorRecordController,
	writingController *controller.WritingController,
	speakingController *controller.SpeakingController,
	authService service.AuthService,
	jwtSecret string,
) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), traceMiddleware())
	router.Static("/web/assets", "./web/assets")
	router.StaticFile("/web", "./web/index.html")
	router.StaticFile("/web/", "./web/index.html")
	router.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/web")
	})

	router.GET("/health", func(c *gin.Context) {
		response.OK(c, gin.H{
			"service": "easitalk-api-go",
			"status":  "ok",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	v1 := router.Group("/v1")
	{
		v1.POST("/auth/register", authController.Register)
		v1.POST("/auth/login", authController.Login)
		v1.GET("/auth/me", AuthMiddleware(authService, jwtSecret), authController.Me)

		// V1 uses explicit userId while auth is being implemented.
		// Later this will be replaced by JWT subject from middleware.
		v1.GET("/users/:userId/profile", profileController.Get)
		v1.PUT("/users/:userId/profile", profileController.Upsert)

		v1.GET("/users/:userId/daily-tasks", taskController.List)
		v1.POST("/users/:userId/daily-tasks/generate", taskController.Generate)
		v1.POST("/users/:userId/daily-tasks/:taskId/complete", taskController.Complete)

		v1.GET("/users/:userId/words", wordController.List)
		v1.POST("/users/:userId/words", wordController.Upsert)
		v1.POST("/users/:userId/words/:wordId/review", wordController.Review)
		v1.DELETE("/users/:userId/words/:wordId", wordController.Delete)

		v1.GET("/users/:userId/error-records", errorRecordController.List)
		v1.POST("/users/:userId/error-records", errorRecordController.Create)

		v1.GET("/users/:userId/writing-submissions", writingController.List)
		v1.POST("/users/:userId/writing-submissions/correct", writingController.Correct)

		v1.POST("/users/:userId/audio-assets", speakingController.UploadAudio)
		v1.GET("/users/:userId/speaking-sessions", speakingController.ListSessions)
		v1.POST("/users/:userId/speaking/chat", speakingController.Chat)
	}

	return router
}

func traceMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		traceID := c.GetHeader("X-Trace-Id")
		if traceID == "" {
			traceID = time.Now().UTC().Format("20060102150405.000000000")
		}
		c.Set("traceId", traceID)
		c.Writer.Header().Set("X-Trace-Id", traceID)
		c.Next()
	}
}

