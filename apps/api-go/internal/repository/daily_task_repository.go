package repository

import (
	"context"
	"errors"
	"time"

	"github.com/easitalk/englishi-app/apps/api-go/internal/model"
	"gorm.io/gorm"
)

type DailyTaskRepository interface {
	ListByUserDate(ctx context.Context, userID uint64, date time.Time) ([]model.UserDailyTask, error)
	FindByID(ctx context.Context, userID uint64, taskID uint64) (*model.UserDailyTask, error)
	Update(ctx context.Context, task *model.UserDailyTask) (*model.UserDailyTask, error)
}

type dailyTaskRepository struct {
	db *gorm.DB
}

func NewDailyTaskRepository(db *gorm.DB) DailyTaskRepository {
	return &dailyTaskRepository{db: db}
}

func (r *dailyTaskRepository) ListByUserDate(ctx context.Context, userID uint64, date time.Time) ([]model.UserDailyTask, error) {
	var tasks []model.UserDailyTask
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND task_date = ?", userID, date.Format("2006-01-02")).
		Order("id ASC").
		Find(&tasks).Error
	return tasks, err
}

func (r *dailyTaskRepository) FindByID(ctx context.Context, userID uint64, taskID uint64) (*model.UserDailyTask, error) {
	var task model.UserDailyTask
	err := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *dailyTaskRepository) Update(ctx context.Context, task *model.UserDailyTask) (*model.UserDailyTask, error) {
	if err := r.db.WithContext(ctx).Save(task).Error; err != nil {
		return nil, err
	}
	return task, nil
}

