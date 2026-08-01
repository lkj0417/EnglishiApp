package service

import (
	"context"
	"encoding/json"
	"time"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"github.com/easitalk/englishi-app/apps/api-go/internal/repository"
	"gorm.io/datatypes"
)

type ErrorRecordService interface {
	List(ctx context.Context, userID uint64, sourceType string) ([]model.UserErrorRecord, error)
	Create(ctx context.Context, userID uint64, input CreateErrorRecordInput) (*model.UserErrorRecord, error)
}

type CreateErrorRecordInput struct {
	SourceType       string   `json:"sourceType" binding:"required,oneof=speaking writing quiz chat"`
	OriginalContent  string   `json:"originalContent" binding:"required,max=8000"`
	CorrectedContent string   `json:"correctedContent" binding:"omitempty,max=8000"`
	ErrorType        string   `json:"errorType" binding:"omitempty,max=64"`
	Explanation      string   `json:"explanation" binding:"omitempty,max=4000"`
	KnowledgePoints  []string `json:"knowledgePoints"`
}

type errorRecordService struct {
	repo repository.ErrorRecordRepository
}

func NewErrorRecordService(repo repository.ErrorRecordRepository) ErrorRecordService {
	return &errorRecordService{repo: repo}
}

func (s *errorRecordService) List(ctx context.Context, userID uint64, sourceType string) ([]model.UserErrorRecord, error) {
	return s.repo.ListByUserID(ctx, userID, sourceType)
}

func (s *errorRecordService) Create(ctx context.Context, userID uint64, input CreateErrorRecordInput) (*model.UserErrorRecord, error) {
	points, _ := json.Marshal(input.KnowledgePoints)
	return s.repo.Create(ctx, &model.UserErrorRecord{
		UserID:           userID,
		SourceType:       input.SourceType,
		OriginalContent:  input.OriginalContent,
		CorrectedContent: input.CorrectedContent,
		ErrorType:        input.ErrorType,
		Explanation:      input.Explanation,
		KnowledgePoints:  datatypes.JSON(points),
		OccurredAt:       time.Now(),
	})
}

