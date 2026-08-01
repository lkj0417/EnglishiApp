package service

import (
	"context"
	"errors"
	"time"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"github.com/easitalk/englishi-app/apps/api-go/internal/repository"
)

type WordService interface {
	List(ctx context.Context, userID uint64) ([]model.UserWord, error)
	Upsert(ctx context.Context, userID uint64, input UpsertWordInput) (*model.UserWord, error)
	Review(ctx context.Context, userID uint64, wordID uint64, input ReviewWordInput) (*model.UserWord, error)
	Delete(ctx context.Context, userID uint64, wordID uint64) error
}

type UpsertWordInput struct {
	Word            string `json:"word" binding:"required,max=128"`
	Meaning         string `json:"meaning" binding:"required,max=512"`
	ExampleSentence string `json:"exampleSentence" binding:"omitempty,max=2000"`
}

type ReviewWordInput struct {
	Remembered bool `json:"remembered"`
}

type wordService struct {
	repo repository.WordRepository
}

func NewWordService(repo repository.WordRepository) WordService {
	return &wordService{repo: repo}
}

func (s *wordService) List(ctx context.Context, userID uint64) ([]model.UserWord, error) {
	return s.repo.ListByUserID(ctx, userID)
}

func (s *wordService) Upsert(ctx context.Context, userID uint64, input UpsertWordInput) (*model.UserWord, error) {
	return s.repo.Upsert(ctx, &model.UserWord{
		UserID:          userID,
		Word:            input.Word,
		Meaning:         input.Meaning,
		ExampleSentence: input.ExampleSentence,
	})
}

func (s *wordService) Review(ctx context.Context, userID uint64, wordID uint64, input ReviewWordInput) (*model.UserWord, error) {
	word, err := s.repo.FindByID(ctx, userID, wordID)
	if err != nil {
		return nil, err
	}
	if word == nil {
		return nil, errors.New("word not found")
	}
	word.ReviewCount++
	if input.Remembered {
		word.MasteryLevel++
		if word.MasteryLevel > 5 {
			word.MasteryLevel = 5
		}
	} else {
		word.ErrorCount++
		word.MasteryLevel--
		if word.MasteryLevel < 0 {
			word.MasteryLevel = 0
		}
	}
	word.NextReviewAt = nextReviewAt(word.MasteryLevel, word.ErrorCount)
	return s.repo.Update(ctx, word)
}

func (s *wordService) Delete(ctx context.Context, userID uint64, wordID uint64) error {
	return s.repo.Delete(ctx, userID, wordID)
}

func nextReviewAt(masteryLevel int, errorCount int) *time.Time {
	days := []int{1, 1, 2, 4, 7, 15}
	idx := masteryLevel
	if idx < 0 {
		idx = 0
	}
	if idx >= len(days) {
		idx = len(days) - 1
	}
	if errorCount > 2 && days[idx] > 1 {
		idx--
	}
	next := time.Now().AddDate(0, 0, days[idx])
	return &next
}

