package controller

import (
	"net/http"
	"strconv"

	"github.com/easitalk/englishi-app/apps/api-go/internal/response"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/gin-gonic/gin"
)

type DailyTaskController struct {
	service service.DailyTaskService
}

func NewDailyTaskController(taskService service.DailyTaskService) *DailyTaskController {
	return &DailyTaskController{service: taskService}
}

func (ctl *DailyTaskController) List(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	tasks, err := ctl.service.ListByDate(c.Request.Context(), userID, c.Query("date"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, 30001, err.Error())
		return
	}
	response.OK(c, gin.H{"items": tasks})
}

func (ctl *DailyTaskController) Generate(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	var input service.GenerateDailyPlanInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, err.Error())
		return
	}
	result, err := ctl.service.Generate(c.Request.Context(), userID, input)
	if err != nil {
		response.Fail(c, http.StatusBadGateway, 40001, err.Error())
		return
	}
	response.OK(c, result)
}

func (ctl *DailyTaskController) Complete(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	taskID, err := strconv.ParseUint(c.Param("taskId"), 10, 64)
	if err != nil || taskID == 0 {
		response.Fail(c, http.StatusBadRequest, 10001, "invalid taskId")
		return
	}
	task, err := ctl.service.Complete(c.Request.Context(), userID, taskID)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, 30002, err.Error())
		return
	}
	response.OK(c, task)
}

