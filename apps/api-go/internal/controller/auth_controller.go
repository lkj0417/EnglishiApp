package controller

import (
	"net/http"

	"github.com/easitalk/englishi-app/apps/api-go/internal/response"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/gin-gonic/gin"
)

type AuthController struct {
	service service.AuthService
}

func NewAuthController(authService service.AuthService) *AuthController {
	return &AuthController{service: authService}
}

func (ctl *AuthController) Register(c *gin.Context) {
	var input service.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, err.Error())
		return
	}
	result, err := ctl.service.Register(c.Request.Context(), input)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, 20001, err.Error())
		return
	}
	response.Created(c, result)
}

func (ctl *AuthController) Login(c *gin.Context) {
	var input service.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, err.Error())
		return
	}
	result, err := ctl.service.Login(c.Request.Context(), input)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, 20002, err.Error())
		return
	}
	response.OK(c, result)
}

func (ctl *AuthController) Me(c *gin.Context) {
	userID := c.GetUint64("userId")
	user, err := ctl.service.GetCurrentUser(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, 20003, err.Error())
		return
	}
	response.OK(c, user)
}

