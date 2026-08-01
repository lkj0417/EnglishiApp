package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"github.com/easitalk/englishi-app/apps/api-go/internal/repository"
	"github.com/easitalk/englishi-app/apps/api-go/pkg/storage"
	"gorm.io/datatypes"
)

type SpeakingService interface {
	UploadAudio(ctx context.Context, userID uint64, fileHeader *multipart.FileHeader, purpose string) (*model.AudioAsset, error)
	Chat(ctx context.Context, userID uint64, input SpeakingChatInput) (*model.SpeakingSession, error)
	ListSessions(ctx context.Context, userID uint64) ([]model.SpeakingSession, error)
}

type SpeakingChatInput struct {
	SessionID    string  `json:"sessionId" binding:"omitempty,max=128"`
	Message      string  `json:"message" binding:"required,min=1,max=4000"`
	AudioAssetID *uint64 `json:"audioAssetId"`
}

type speakingService struct {
	repo      repository.SpeakingRepository
	storage   *storage.MinIOStorage
	aiBaseURL string
}

func NewSpeakingService(repo repository.SpeakingRepository, storage *storage.MinIOStorage, aiBaseURL string) SpeakingService {
	return &speakingService{repo: repo, storage: storage, aiBaseURL: aiBaseURL}
}

func (s *speakingService) UploadAudio(ctx context.Context, userID uint64, fileHeader *multipart.FileHeader, purpose string) (*model.AudioAsset, error) {
	if fileHeader == nil {
		return nil, errors.New("audio file is required")
	}
	if purpose == "" {
		purpose = "speaking_recording"
	}
	file, err := fileHeader.Open()
	if err != nil {
		return nil, err
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext == "" {
		ext = ".webm"
	}
	objectKey := fmt.Sprintf("users/%d/speaking/%d%s", userID, time.Now().UnixNano(), ext)
	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	publicURL, err := s.storage.Upload(ctx, objectKey, file, fileHeader.Size, contentType)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateAudioAsset(ctx, &model.AudioAsset{
		UserID:           userID,
		Bucket:           s.storage.Bucket(),
		ObjectKey:        objectKey,
		OriginalFilename: fileHeader.Filename,
		MimeType:         contentType,
		SizeBytes:        uint64(fileHeader.Size),
		Purpose:          purpose,
		PublicURL:        publicURL,
		Status:           "uploaded",
	})
}

func (s *speakingService) Chat(ctx context.Context, userID uint64, input SpeakingChatInput) (*model.SpeakingSession, error) {
	if input.SessionID == "" {
		input.SessionID = fmt.Sprintf("speaking-%d-%d", userID, time.Now().UnixNano())
	}
	payload := map[string]interface{}{
		"userId":    userID,
		"sessionId": input.SessionID,
		"message":   input.Message,
	}
	if input.AudioAssetID != nil {
		payload["audioAssetId"] = *input.AudioAssetID
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.aiBaseURL+"/v1/speaking/chat", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 45 * time.Second}).Do(req)
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
			envelope.Message = "speaking chat failed"
		}
		return nil, errors.New(envelope.Message)
	}

	reply, _ := envelope.Data["reply"].(string)
	ttsText, _ := envelope.Data["ttsText"].(string)
	ttsURL, _ := envelope.Data["ttsAudioUrl"].(string)
	var score *float64
	if pronunciation, ok := envelope.Data["pronunciation"].(map[string]interface{}); ok {
		if raw, ok := pronunciation["overallScore"].(float64); ok {
			score = &raw
		}
	}
	pronJSON, _ := json.Marshal(envelope.Data["pronunciation"])

	return s.repo.CreateSession(ctx, &model.SpeakingSession{
		UserID:              userID,
		SessionID:           input.SessionID,
		AudioAssetID:        input.AudioAssetID,
		UserText:            input.Message,
		AIReply:             reply,
		PronunciationResult: datatypes.JSON(pronJSON),
		TTSText:             ttsText,
		TTSAudioURL:         ttsURL,
		Score:               score,
		Status:              "completed",
	})
}

func (s *speakingService) ListSessions(ctx context.Context, userID uint64) ([]model.SpeakingSession, error) {
	return s.repo.ListSessions(ctx, userID)
}

