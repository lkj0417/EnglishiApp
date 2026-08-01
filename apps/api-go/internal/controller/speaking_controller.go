package controller

import (
	"net/http"

	"github.com/easitalk/englishi-app/apps/api-go/internal/response"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/gin-gonic/gin"
)

type SpeakingController struct {
	service service.SpeakingService
}

func NewSpeakingController(speakingService service.SpeakingService) *SpeakingController {
	return &SpeakingController{service: speakingService}
}

func (ctl *SpeakingController) UploadAudio(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, "file field is required")
		return
	}
	asset, err := ctl.service.UploadAudio(c.Request.Context(), userID, fileHeader, c.PostForm("purpose"))
	if err != nil {
		response.Fail(c, http.StatusBadGateway, 50001, err.Error())
		return
	}
	response.Created(c, asset)
}

func (ctl *SpeakingController) Chat(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	var input service.SpeakingChatInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, err.Error())
		return
	}
	session, err := ctl.service.Chat(c.Request.Context(), userID, input)
	if err != nil {
		response.Fail(c, http.StatusBadGateway, 40003, err.Error())
		return
	}
	response.Created(c, session)
}

func (ctl *SpeakingController) ListSessions(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	sessions, err := ctl.service.ListSessions(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, 10002, err.Error())
		return
	}
	response.OK(c, gin.H{"items": sessions})
}

