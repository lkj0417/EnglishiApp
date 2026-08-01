package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"github.com/easitalk/englishi-app/apps/api-go/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	goredis "github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

type AuthService interface {
	Register(ctx context.Context, input RegisterInput) (*AuthResult, error)
	Login(ctx context.Context, input LoginInput) (*AuthResult, error)
	GetCurrentUser(ctx context.Context, userID uint64) (*model.User, error)
	ValidateSession(ctx context.Context, token string, userID uint64) error
}

type RegisterInput struct {
	Email    string `json:"email" binding:"required,email,max=128"`
	Password string `json:"password" binding:"required,min=8,max=72"`
	Nickname string `json:"nickname" binding:"omitempty,max=64"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email,max=128"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

type AuthResult struct {
	Token     string      `json:"token"`
	ExpiresIn int64       `json:"expiresIn"`
	User      *model.User `json:"user"`
}

type authService struct {
	users     repository.UserRepository
	redis     *goredis.Client
	jwtSecret []byte
	ttl        time.Duration
}

func NewAuthService(users repository.UserRepository, redis *goredis.Client, jwtSecret string, ttl time.Duration) AuthService {
	return &authService{users: users, redis: redis, jwtSecret: []byte(jwtSecret), ttl: ttl}
}

func (s *authService) Register(ctx context.Context, input RegisterInput) (*AuthResult, error) {
	existing, err := s.users.FindByEmail(ctx, input.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("email already registered")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	email := input.Email
	nickname := input.Nickname
	if nickname == "" {
		nickname = "EasiTalk Learner"
	}
	user, err := s.users.Create(ctx, &model.User{
		Email:        &email,
		PasswordHash: string(hash),
		Nickname:     nickname,
		Status:       1,
	})
	if err != nil {
		return nil, err
	}
	return s.issueToken(ctx, user)
}

func (s *authService) Login(ctx context.Context, input LoginInput) (*AuthResult, error) {
	user, err := s.users.FindByEmail(ctx, input.Email)
	if err != nil {
		return nil, err
	}
	if user == nil || user.Status != 1 {
		return nil, errors.New("invalid email or password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}
	return s.issueToken(ctx, user)
}

func (s *authService) GetCurrentUser(ctx context.Context, userID uint64) (*model.User, error) {
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	return user, nil
}

func (s *authService) ValidateSession(ctx context.Context, token string, userID uint64) error {
	stored, err := s.redis.Get(ctx, sessionKey(userID)).Result()
	if err != nil {
		return errors.New("session expired")
	}
	if stored != token {
		return errors.New("session invalid")
	}
	return nil
}

func (s *authService) issueToken(ctx context.Context, user *model.User) (*AuthResult, error) {
	now := time.Now()
	expiresAt := now.Add(s.ttl)
	claims := jwt.MapClaims{
		"sub": fmt.Sprintf("%d", user.ID),
		"iat": now.Unix(),
		"exp": expiresAt.Unix(),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
	if err != nil {
		return nil, err
	}
	if err := s.redis.Set(ctx, sessionKey(user.ID), token, s.ttl).Err(); err != nil {
		return nil, err
	}
	return &AuthResult{Token: token, ExpiresIn: int64(s.ttl.Seconds()), User: user}, nil
}

func sessionKey(userID uint64) string {
	return fmt.Sprintf("login:%d", userID)
}

