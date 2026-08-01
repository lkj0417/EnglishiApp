package controller

import (
	"net/http"

	"github.com/easitalk/englishi-app/apps/api-go/internal/response"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/gin-gonic/gin"
)

type ErrorRecordController struct {
	service service.ErrorRecordService
}

func NewErrorRecordController(errorService service.ErrorRecordService) *ErrorRecordController {
	return &ErrorRecordController{service: errorService}
}

func (ctl *ErrorRecordController) List(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	records, err := ctl.service.List(c.Request.Context(), userID, c.Query("sourceType"))
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, 10002, err.Error())
		return
	}
	response.OK(c, gin.H{"items": records})
}

func (ctl *ErrorRecordController) Create(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	var input service.CreateErrorRecordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, err.Error())
		return
	}
	record, err := ctl.service.Create(c.Request.Context(), userID, input)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, 30021, err.Error())
		return
	}
	response.Created(c, record)
}

