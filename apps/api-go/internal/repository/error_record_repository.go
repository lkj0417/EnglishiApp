package repository

import (
	"context"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"gorm.io/gorm"
)

type ErrorRecordRepository interface {
	ListByUserID(ctx context.Context, userID uint64, sourceType string) ([]model.UserErrorRecord, error)
	Create(ctx context.Context, record *model.UserErrorRecord) (*model.UserErrorRecord, error)
}

type errorRecordRepository struct {
	db *gorm.DB
}

func NewErrorRecordRepository(db *gorm.DB) ErrorRecordRepository {
	return &errorRecordRepository{db: db}
}

func (r *errorRecordRepository) ListByUserID(ctx context.Context, userID uint64, sourceType string) ([]model.UserErrorRecord, error) {
	var records []model.UserErrorRecord
	query := r.db.WithContext(ctx).Where("user_id = ?", userID)
	if sourceType != "" {
		query = query.Where("source_type = ?", sourceType)
	}
	err := query.Order("occurred_at DESC, id DESC").Limit(100).Find(&records).Error
	return records, err
}

func (r *errorRecordRepository) Create(ctx context.Context, record *model.UserErrorRecord) (*model.UserErrorRecord, error) {
	if err := r.db.WithContext(ctx).Create(record).Error; err != nil {
		return nil, err
	}
	return record, nil
}

