package repository

import (
	"context"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"gorm.io/gorm"
)

type WritingRepository interface {
	Create(ctx context.Context, submission *model.WritingSubmission) (*model.WritingSubmission, error)
	ListByUserID(ctx context.Context, userID uint64) ([]model.WritingSubmission, error)
}

type writingRepository struct {
	db *gorm.DB
}

func NewWritingRepository(db *gorm.DB) WritingRepository {
	return &writingRepository{db: db}
}

func (r *writingRepository) Create(ctx context.Context, submission *model.WritingSubmission) (*model.WritingSubmission, error) {
	if err := r.db.WithContext(ctx).Create(submission).Error; err != nil {
		return nil, err
	}
	return submission, nil
}

func (r *writingRepository) ListByUserID(ctx context.Context, userID uint64) ([]model.WritingSubmission, error) {
	var submissions []model.WritingSubmission
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC, id DESC").
		Limit(50).
		Find(&submissions).Error
	return submissions, err
}

