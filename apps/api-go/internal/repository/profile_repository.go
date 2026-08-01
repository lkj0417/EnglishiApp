package repository

import (
	"context"
	"errors"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"gorm.io/gorm"
)

type ProfileRepository interface {
	FindByUserID(ctx context.Context, userID uint64) (*model.UserLearningProfile, error)
	Upsert(ctx context.Context, profile *model.UserLearningProfile) (*model.UserLearningProfile, error)
}

type profileRepository struct {
	db *gorm.DB
}

func NewProfileRepository(db *gorm.DB) ProfileRepository {
	return &profileRepository{db: db}
}

func (r *profileRepository) FindByUserID(ctx context.Context, userID uint64) (*model.UserLearningProfile, error) {
	var profile model.UserLearningProfile
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (r *profileRepository) Upsert(ctx context.Context, profile *model.UserLearningProfile) (*model.UserLearningProfile, error) {
	var existing model.UserLearningProfile
	err := r.db.WithContext(ctx).Where("user_id = ?", profile.UserID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := r.db.WithContext(ctx).Create(profile).Error; err != nil {
			return nil, err
		}
		return profile, nil
	}
	if err != nil {
		return nil, err
	}

	profile.ID = existing.ID
	if err := r.db.WithContext(ctx).Model(&existing).Updates(profile).Error; err != nil {
		return nil, err
	}
	return r.FindByUserID(ctx, profile.UserID)
}

