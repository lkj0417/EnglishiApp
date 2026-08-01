package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"github.com/easitalk/englishi-app/apps/api-go/internal/repository"
	"gorm.io/datatypes"
)

type WritingService interface {
	Correct(ctx context.Context, userID uint64, input CorrectWritingInput) (*model.WritingSubmission, error)
	List(ctx context.Context, userID uint64) ([]model.WritingSubmission, error)
}

type CorrectWritingInput struct {
	Title   string `json:"title" binding:"required,max=255"`
	Content string `json:"content" binding:"required,min=10,max=12000"`
}

type writingService struct {
	repo      repository.WritingRepository
	aiBaseURL string
}

func NewWritingService(repo repository.WritingRepository, aiBaseURL string) WritingService {
	return &writingService{repo: repo, aiBaseURL: aiBaseURL}
}

func (s *writingService) Correct(ctx context.Context, userID uint64, input CorrectWritingInput) (*model.WritingSubmission, error) {
	payload := map[string]interface{}{
		"userId":    userID,
		"sessionId": fmt.Sprintf("writing-%d-%d", userID, time.Now().UnixNano()),
		"title":     input.Title,
		"content":   input.Content,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.aiBaseURL+"/v1/writing/correct", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var envelope struct {
		Code    int                    `json:"code"`
		Message string                 `json:"message"`
		Data    map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 || envelope.Code != 0 {
		if envelope.Message == "" {
			envelope.Message = "writing correction failed"
		}
		return nil, errors.New(envelope.Message)
	}

	resultJSON, _ := json.Marshal(envelope.Data)
	correctedContent, _ := envelope.Data["correctedContent"].(string)
	var bandScore *float64
	if raw, ok := envelope.Data["bandScore"].(float64); ok {
		bandScore = &raw
	}

	return s.repo.Create(ctx, &model.WritingSubmission{
		UserID:           userID,
		Title:            input.Title,
		OriginalContent:  input.Content,
		CorrectedContent: correctedContent,
		CorrectionResult: datatypes.JSON(resultJSON),
		BandScore:        bandScore,
		Status:           "corrected",
	})
}

func (s *writingService) List(ctx context.Context, userID uint64) ([]model.WritingSubmission, error) {
	return s.repo.ListByUserID(ctx, userID)
}

