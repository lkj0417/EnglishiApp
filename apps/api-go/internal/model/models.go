package model

import (
	"time"

	"gorm.io/datatypes"
)

type User struct {
	ID           uint64    `gorm:"primaryKey;column:id" json:"id"`
	Phone        *string   `gorm:"column:phone" json:"phone,omitempty"`
	Email        *string   `gorm:"column:email" json:"email,omitempty"`
	PasswordHash string    `gorm:"column:password_hash" json:"-"`
	Nickname     string    `gorm:"column:nickname" json:"nickname"`
	AvatarURL    *string   `gorm:"column:avatar_url" json:"avatarUrl,omitempty"`
	Status       int       `gorm:"column:status" json:"status"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (User) TableName() string { return "user" }

type UserLearningProfile struct {
	ID                  uint64         `gorm:"primaryKey;column:id" json:"id"`
	UserID              uint64         `gorm:"column:user_id;uniqueIndex" json:"userId"`
	CEFRLevel           string         `gorm:"column:cefr_level" json:"cefrLevel"`
	LearningGoal        string         `gorm:"column:learning_goal" json:"learningGoal"`
	DailyMinutes        int            `gorm:"column:daily_minutes" json:"dailyMinutes"`
	PainPoints          datatypes.JSON `gorm:"column:pain_points" json:"painPoints"`
	MaterialPreferences datatypes.JSON `gorm:"column:material_preferences" json:"materialPreferences"`
	WeakGrammarPoints   datatypes.JSON `gorm:"column:weak_grammar_points" json:"weakGrammarPoints"`
	ErrorProneWords     datatypes.JSON `gorm:"column:error_prone_words" json:"errorProneWords"`
	SpeakingWeaknesses  datatypes.JSON `gorm:"column:speaking_weaknesses" json:"speakingWeaknesses"`
	WritingWeaknesses   datatypes.JSON `gorm:"column:writing_weaknesses" json:"writingWeaknesses"`
	LatestAssessmentAt  *time.Time     `gorm:"column:latest_assessment_at" json:"latestAssessmentAt,omitempty"`
	AbilityScores       datatypes.JSON `gorm:"column:ability_scores" json:"abilityScores"`
	CreatedAt           time.Time      `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt           time.Time      `gorm:"column:updated_at" json:"updatedAt"`
}

func (UserLearningProfile) TableName() string { return "user_learning_profile" }

type UserWord struct {
	ID              uint64         `gorm:"primaryKey;column:id" json:"id"`
	UserID          uint64         `gorm:"column:user_id;index" json:"userId"`
	Word            string         `gorm:"column:word" json:"word"`
	Meaning         string         `gorm:"column:meaning" json:"meaning"`
	ExampleSentence string         `gorm:"column:example_sentence" json:"exampleSentence"`
	MasteryLevel    int            `gorm:"column:mastery_level" json:"masteryLevel"`
	ReviewCount     int            `gorm:"column:review_count" json:"reviewCount"`
	ErrorCount      int            `gorm:"column:error_count" json:"errorCount"`
	NextReviewAt    *time.Time     `gorm:"column:next_review_at" json:"nextReviewAt,omitempty"`
	CreatedAt       time.Time      `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt       time.Time      `gorm:"column:updated_at" json:"updatedAt"`
}

func (UserWord) TableName() string { return "user_word" }

type UserErrorRecord struct {
	ID               uint64         `gorm:"primaryKey;column:id" json:"id"`
	UserID           uint64         `gorm:"column:user_id;index" json:"userId"`
	SourceType       string         `gorm:"column:source_type" json:"sourceType"`
	OriginalContent  string         `gorm:"column:original_content" json:"originalContent"`
	CorrectedContent string         `gorm:"column:corrected_content" json:"correctedContent"`
	ErrorType        string         `gorm:"column:error_type" json:"errorType"`
	Explanation      string         `gorm:"column:explanation" json:"explanation"`
	KnowledgePoints  datatypes.JSON `gorm:"column:knowledge_points" json:"knowledgePoints"`
	OccurredAt       time.Time      `gorm:"column:occurred_at" json:"occurredAt"`
	CreatedAt        time.Time      `gorm:"column:created_at" json:"createdAt"`
}

func (UserErrorRecord) TableName() string { return "user_error_record" }

type UserDailyTask struct {
	ID               uint64         `gorm:"primaryKey;column:id" json:"id"`
	UserID           uint64         `gorm:"column:user_id;index" json:"userId"`
	TaskDate         time.Time      `gorm:"column:task_date" json:"taskDate"`
	TaskType         string         `gorm:"column:task_type" json:"taskType"`
	Title            string         `gorm:"column:title" json:"title"`
	Payload          datatypes.JSON `gorm:"column:payload" json:"payload"`
	EstimatedMinutes int            `gorm:"column:estimated_minutes" json:"estimatedMinutes"`
	Status           string         `gorm:"column:status" json:"status"`
	CompletedAt      *time.Time     `gorm:"column:completed_at" json:"completedAt,omitempty"`
	CreatedAt        time.Time      `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt        time.Time      `gorm:"column:updated_at" json:"updatedAt"`
}

func (UserDailyTask) TableName() string { return "user_daily_task" }

type WritingSubmission struct {
	ID               uint64         `gorm:"primaryKey;column:id" json:"id"`
	UserID           uint64         `gorm:"column:user_id;index" json:"userId"`
	Title            string         `gorm:"column:title" json:"title"`
	OriginalContent  string         `gorm:"column:original_content" json:"originalContent"`
	CorrectedContent string         `gorm:"column:corrected_content" json:"correctedContent"`
	CorrectionResult datatypes.JSON `gorm:"column:correction_result" json:"correctionResult"`
	BandScore        *float64       `gorm:"column:band_score" json:"bandScore,omitempty"`
	Status           string         `gorm:"column:status" json:"status"`
	CreatedAt        time.Time      `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt        time.Time      `gorm:"column:updated_at" json:"updatedAt"`
}

func (WritingSubmission) TableName() string { return "writing_submission" }

type AudioAsset struct {
	ID               uint64    `gorm:"primaryKey;column:id" json:"id"`
	UserID           uint64    `gorm:"column:user_id;index" json:"userId"`
	Bucket           string    `gorm:"column:bucket" json:"bucket"`
	ObjectKey        string    `gorm:"column:object_key" json:"objectKey"`
	OriginalFilename string    `gorm:"column:original_filename" json:"originalFilename"`
	MimeType         string    `gorm:"column:mime_type" json:"mimeType"`
	SizeBytes        uint64    `gorm:"column:size_bytes" json:"sizeBytes"`
	Purpose          string    `gorm:"column:purpose" json:"purpose"`
	PublicURL        string    `gorm:"column:public_url" json:"publicUrl"`
	Status           string    `gorm:"column:status" json:"status"`
	CreatedAt        time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt        time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (AudioAsset) TableName() string { return "audio_asset" }

type SpeakingSession struct {
	ID                  uint64         `gorm:"primaryKey;column:id" json:"id"`
	UserID              uint64         `gorm:"column:user_id;index" json:"userId"`
	SessionID           string         `gorm:"column:session_id" json:"sessionId"`
	AudioAssetID        *uint64        `gorm:"column:audio_asset_id" json:"audioAssetId,omitempty"`
	UserText            string         `gorm:"column:user_text" json:"userText"`
	AIReply             string         `gorm:"column:ai_reply" json:"aiReply"`
	PronunciationResult datatypes.JSON `gorm:"column:pronunciation_result" json:"pronunciationResult"`
	TTSText             string         `gorm:"column:tts_text" json:"ttsText"`
	TTSAudioURL         string         `gorm:"column:tts_audio_url" json:"ttsAudioUrl"`
	Score               *float64       `gorm:"column:score" json:"score,omitempty"`
	Status              string         `gorm:"column:status" json:"status"`
	CreatedAt           time.Time      `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt           time.Time      `gorm:"column:updated_at" json:"updatedAt"`
}

func (SpeakingSession) TableName() string { return "speaking_session" }
type AudioAsset struct {
	ID               uint64    `gorm:"primaryKey;column:id" json:"id"`
	UserID           uint64    `gorm:"column:user_id;index" json:"userId"`
	Bucket           string    `gorm:"column:bucket" json:"bucket"`
	ObjectKey        string    `gorm:"column:object_key" json:"objectKey"`
	OriginalFilename string    `gorm:"column:original_filename" json:"originalFilename"`
	MimeType         string    `gorm:"column:mime_type" json:"mimeType"`
	SizeBytes        uint64    `gorm:"column:size_bytes" json:"sizeBytes"`
	Purpose          string    `gorm:"column:purpose" json:"purpose"`
	PublicURL        string    `gorm:"column:public_url" json:"publicUrl"`
	Status           string    `gorm:"column:status" json:"status"`
	CreatedAt        time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt        time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (AudioAsset) TableName() string { return "audio_asset" }

type SpeakingSession struct {
	ID                  uint64         `gorm:"primaryKey;column:id" json:"id"`
	UserID              uint64         `gorm:"column:user_id;index" json:"userId"`
	SessionID           string         `gorm:"column:session_id" json:"sessionId"`
	AudioAssetID        *uint64        `gorm:"column:audio_asset_id" json:"audioAssetId,omitempty"`
	UserText            string         `gorm:"column:user_text" json:"userText"`
	AIReply             string         `gorm:"column:ai_reply" json:"aiReply"`
	PronunciationResult datatypes.JSON `gorm:"column:pronunciation_result" json:"pronunciationResult"`
	TTSText             string         `gorm:"column:tts_text" json:"ttsText"`
	TTSAudioURL         string         `gorm:"column:tts_audio_url" json:"ttsAudioUrl"`
	Score               *float64       `gorm:"column:score" json:"score,omitempty"`
	Status              string         `gorm:"column:status" json:"status"`
	CreatedAt           time.Time      `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt           time.Time      `gorm:"column:updated_at" json:"updatedAt"`
}

func (SpeakingSession) TableName() string { return "speaking_session" }

