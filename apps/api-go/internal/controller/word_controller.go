package controller

import (
	"net/http"
	"strconv"

	"github.com/easitalk/englishi-app/apps/api-go/internal/response"
	"github.com/easitalk/englishi-app/apps/api-go/internal/service"
	"github.com/gin-gonic/gin"
)

type WordController struct {
	service service.WordService
}

func NewWordController(wordService service.WordService) *WordController {
	return &WordController{service: wordService}
}

func (ctl *WordController) List(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	words, err := ctl.service.List(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, 10002, err.Error())
		return
	}
	response.OK(c, gin.H{"items": words})
}

func (ctl *WordController) Upsert(c *gin.Context) {
	userID, ok := parseUserID(c)
	if !ok {
		return
	}
	var input service.UpsertWordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, err.Error())
		return
	}
	word, err := ctl.service.Upsert(c.Request.Context(), userID, input)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, 30011, err.Error())
		return
	}
	response.OK(c, word)
}

func (ctl *WordController) Review(c *gin.Context) {
	userID, wordID, ok := parseUserAndWordID(c)
	if !ok {
		return
	}
	var input service.ReviewWordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Fail(c, http.StatusBadRequest, 10001, err.Error())
		return
	}
	word, err := ctl.service.Review(c.Request.Context(), userID, wordID, input)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, 30012, err.Error())
		return
	}
	response.OK(c, word)
}

func (ctl *WordController) Delete(c *gin.Context) {
	userID, wordID, ok := parseUserAndWordID(c)
	if !ok {
		return
	}
	if err := ctl.service.Delete(c.Request.Context(), userID, wordID); err != nil {
		response.Fail(c, http.StatusBadRequest, 30013, err.Error())
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

func parseUserAndWordID(c *gin.Context) (uint64, uint64, bool) {
	userID, ok := parseUserID(c)
	if !ok {
		return 0, 0, false
	}
	wordID, err := strconv.ParseUint(c.Param("wordId"), 10, 64)
	if err != nil || wordID == 0 {
		response.Fail(c, http.StatusBadRequest, 10001, "invalid wordId")
		return 0, 0, false
	}
	return userID, wordID, true
}

