package repository

import (
	"context"
	"errors"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"gorm.io/gorm"
)

type WordRepository interface {
	ListByUserID(ctx context.Context, userID uint64) ([]model.UserWord, error)
	FindByID(ctx context.Context, userID uint64, wordID uint64) (*model.UserWord, error)
	Upsert(ctx context.Context, word *model.UserWord) (*model.UserWord, error)
	Update(ctx context.Context, word *model.UserWord) (*model.UserWord, error)
	Delete(ctx context.Context, userID uint64, wordID uint64) error
}

type wordRepository struct {
	db *gorm.DB
}

func NewWordRepository(db *gorm.DB) WordRepository {
	return &wordRepository{db: db}
}

func (r *wordRepository) ListByUserID(ctx context.Context, userID uint64) ([]model.UserWord, error) {
	var words []model.UserWord
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("next_review_at IS NULL ASC, next_review_at ASC, id DESC").Find(&words).Error
	return words, err
}

func (r *wordRepository) FindByID(ctx context.Context, userID uint64, wordID uint64) (*model.UserWord, error) {
	var word model.UserWord
	err := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", wordID, userID).First(&word).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &word, nil
}

func (r *wordRepository) Upsert(ctx context.Context, word *model.UserWord) (*model.UserWord, error) {
	var existing model.UserWord
	err := r.db.WithContext(ctx).Where("user_id = ? AND word = ?", word.UserID, word.Word).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := r.db.WithContext(ctx).Create(word).Error; err != nil {
			return nil, err
		}
		return word, nil
	}
	if err != nil {
		return nil, err
	}
	existing.Meaning = word.Meaning
	existing.ExampleSentence = word.ExampleSentence
	if err := r.db.WithContext(ctx).Save(&existing).Error; err != nil {
		return nil, err
	}
	return &existing, nil
}

func (r *wordRepository) Update(ctx context.Context, word *model.UserWord) (*model.UserWord, error) {
	if err := r.db.WithContext(ctx).Save(word).Error; err != nil {
		return nil, err
	}
	return word, nil
}

func (r *wordRepository) Delete(ctx context.Context, userID uint64, wordID uint64) error {
	return r.db.WithContext(ctx).Where("id = ? AND user_id = ?", wordID, userID).Delete(&model.UserWord{}).Error
}

