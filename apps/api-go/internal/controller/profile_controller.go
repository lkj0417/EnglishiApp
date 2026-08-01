package controller

import (
	"net/http"
	"strconv"

	"github.com/easitalk/englishi-app/apps/api-go/internal/response"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/gin-gonic/gin"
)

type ProfileController struct {
	service service.ProfileService
}

func NewProfileController(profileService service.ProfileService) *ProfileController {
	return &ProfileController{service: profileService}
}

func (ctl *ProfileController) Get(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}

	profile, err := ctl.service.GetProfile(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, 20001, err.Error())
		return
	}
	response.OK(c, profile)
}

func (ctl *ProfileController) Upsert(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}

	var input service.UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, err.Error())
		return
	}

	profile, err := ctl.service.UpdateProfile(c.Request.Context(), userID, input)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, 10002, err.Error())
		return
	}
	response.OK(c, profile)
}

func parseUserID(c *gin.Context) (uint64, bool) {
	userID, err := strconv.ParseUint(c.Param("userId"), 10, 64)
	if err != nil || userID == 0 {
		response.Fail(c, http.StatusBadRequest, 10001, "invalid userId")
		return 0, false
	}
	return userID, true
}

