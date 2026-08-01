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
)

type DailyTaskService interface {
	ListByDate(ctx context.Context, userID uint64, dateText string) ([]model.UserDailyTask, error)
	Complete(ctx context.Context, userID uint64, taskID uint64) (*model.UserDailyTask, error)
	Generate(ctx context.Context, userID uint64, input GenerateDailyPlanInput) (map[string]interface{}, error)
}

type GenerateDailyPlanInput struct {
	TaskDate         string `json:"taskDate" binding:"omitempty"`
	AvailableMinutes int    `json:"availableMinutes" binding:"omitempty,min=5,max=240"`
}

type dailyTaskService struct {
	repo      repository.DailyTaskRepository
	aiBaseURL string
}

func NewDailyTaskService(repo repository.DailyTaskRepository, aiBaseURL string) DailyTaskService {
	return &dailyTaskService{repo: repo, aiBaseURL: aiBaseURL}
}

func (s *dailyTaskService) ListByDate(ctx context.Context, userID uint64, dateText string) ([]model.UserDailyTask, error) {
	if dateText == "" {
		dateText = time.Now().Format("2006-01-02")
	}
	date, err := time.Parse("2006-01-02", dateText)
	if err != nil {
		return nil, errors.New("date must be YYYY-MM-DD")
	}
	return s.repo.ListByUserDate(ctx, userID, date)
}

func (s *dailyTaskService) Complete(ctx context.Context, userID uint64, taskID uint64) (*model.UserDailyTask, error) {
	task, err := s.repo.FindByID(ctx, userID, taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}
	now := time.Now()
	task.Status = "completed"
	task.CompletedAt = &now
	return s.repo.Update(ctx, task)
}

func (s *dailyTaskService) Generate(ctx context.Context, userID uint64, input GenerateDailyPlanInput) (map[string]interface{}, error) {
	if input.TaskDate == "" {
		input.TaskDate = time.Now().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", input.TaskDate); err != nil {
		return nil, errors.New("taskDate must be YYYY-MM-DD")
	}
	if input.AvailableMinutes == 0 {
		input.AvailableMinutes = 20
	}

	payload := map[string]interface{}{
		"userId":           userID,
		"taskDate":         input.TaskDate,
		"availableMinutes": input.AvailableMinutes,
		"sessionId":        fmt.Sprintf("daily-plan-%d-%s", userID, input.TaskDate),
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.aiBaseURL+"/v1/plan/generate", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
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
		return nil, errors.New(envelope.Message)
	}
	return envelope.Data, nil
}

