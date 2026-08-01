package repository

import (
	"context"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"gorm.io/gorm"
)

type SpeakingRepository interface {
	CreateAudioAsset(ctx context.Context, asset *model.AudioAsset) (*model.AudioAsset, error)
	CreateSession(ctx context.Context, session *model.SpeakingSession) (*model.SpeakingSession, error)
	ListSessions(ctx context.Context, userID uint64) ([]model.SpeakingSession, error)
}

type speakingRepository struct {
	db *gorm.DB
}

func NewSpeakingRepository(db *gorm.DB) SpeakingRepository {
	return &speakingRepository{db: db}
}

func (r *speakingRepository) CreateAudioAsset(ctx context.Context, asset *model.AudioAsset) (*model.AudioAsset, error) {
	if err := r.db.WithContext(ctx).Create(asset).Error; err != nil {
		return nil, err
	}
	return asset, nil
}

func (r *speakingRepository) CreateSession(ctx context.Context, session *model.SpeakingSession) (*model.SpeakingSession, error) {
	if err := r.db.WithContext(ctx).Create(session).Error; err != nil {
		return nil, err
	}
	return session, nil
}

func (r *speakingRepository) ListSessions(ctx context.Context, userID uint64) ([]model.SpeakingSession, error) {
	var sessions []model.SpeakingSession
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC, id DESC").Limit(50).Find(&sessions).Error
	return sessions, err
}

