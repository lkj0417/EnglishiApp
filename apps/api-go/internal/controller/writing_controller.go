package controller

import (
	"net/http"

	"github.com/easitalk/englishi-app/apps/api-go/internal/response"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/gin-gonic/gin"
)

type WritingController struct {
	service service.WritingService
}

func NewWritingController(writingService service.WritingService) *WritingController {
	return &WritingController{service: writingService}
}

func (ctl *WritingController) Correct(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	var input service.CorrectWritingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, err.Error())
		return
	}
	submission, err := ctl.service.Correct(c.Request.Context(), userID, input)
	if err != nil {
		response.Fail(c, http.StatusBadGateway, 40002, err.Error())
		return
	}
	response.Created(c, submission)
}

func (ctl *WritingController) List(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	submissions, err := ctl.service.List(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, 10002, err.Error())
		return
	}
	response.OK(c, gin.H{"items": submissions})
}

