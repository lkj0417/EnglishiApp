package redis

import (
	"context"

	goredis "github.com/redis/go-redis/v9"
)

func Connect(redisURL string) (*goredis.Client, error) {
	opt, err := goredis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	client := goredis.NewClient(opt)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	return client, nil
}

