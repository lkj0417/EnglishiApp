package service

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"github.com/easitalk/englishi-app/apps/api-go/internal/repository"
	"gorm.io/datatypes"
)

type ProfileService interface {
	GetProfile(ctx context.Context, userID uint64) (*model.UserLearningProfile, error)
	UpdateProfile(ctx context.Context, userID uint64, input UpdateProfileInput) (*model.UserLearningProfile, error)
}

type UpdateProfileInput struct {
	CEFRLevel           string   `json:"cefrLevel" binding:"omitempty,oneof=A1 A2 B1 B2 C1 C2"`
	LearningGoal        string   `json:"learningGoal" binding:"omitempty,max=255"`
	DailyMinutes        int      `json:"dailyMinutes" binding:"omitempty,min=5,max=240"`
	PainPoints          []string `json:"painPoints"`
	MaterialPreferences []string `json:"materialPreferences"`
	WeakGrammarPoints   []string `json:"weakGrammarPoints"`
	ErrorProneWords     []string `json:"errorProneWords"`
	SpeakingWeaknesses  []string `json:"speakingWeaknesses"`
	WritingWeaknesses   []string `json:"writingWeaknesses"`
}

type profileService struct {
	repo repository.ProfileRepository
}

func NewProfileService(repo repository.ProfileRepository) ProfileService {
	return &profileService{repo: repo}
}

func (s *profileService) GetProfile(ctx context.Context, userID uint64) (*model.UserLearningProfile, error) {
	profile, err := s.repo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.New("profile not found")
	}
	return profile, nil
}

func (s *profileService) UpdateProfile(ctx context.Context, userID uint64, input UpdateProfileInput) (*model.UserLearningProfile, error) {
	profile := &model.UserLearningProfile{
		UserID:              userID,
		CEFRLevel:           defaultString(input.CEFRLevel, "A1"),
		LearningGoal:        input.LearningGoal,
		DailyMinutes:        defaultInt(input.DailyMinutes, 20),
		PainPoints:          mustJSON(input.PainPoints),
		MaterialPreferences: mustJSON(input.MaterialPreferences),
		WeakGrammarPoints:   mustJSON(input.WeakGrammarPoints),
		ErrorProneWords:     mustJSON(input.ErrorProneWords),
		SpeakingWeaknesses:  mustJSON(input.SpeakingWeaknesses),
		WritingWeaknesses:   mustJSON(input.WritingWeaknesses),
		AbilityScores:       datatypes.JSON([]byte(`{}`)),
	}
	return s.repo.Upsert(ctx, profile)
}

func defaultString(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func defaultInt(value int, fallback int) int {
	if value == 0 {
		return fallback
	}
	return value
}

func mustJSON(value []string) datatypes.JSON {
	if value == nil {
		return datatypes.JSON([]byte(`[]`))
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return datatypes.JSON([]byte(`[]`))
	}
	return datatypes.JSON(encoded)
}

