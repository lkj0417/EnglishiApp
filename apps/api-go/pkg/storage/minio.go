package storage

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinIOStorage struct {
	client         *minio.Client
	bucket         string
	publicEndpoint string
}

func NewMinIOStorage(endpoint string, publicEndpoint string, accessKey string, secretKey string, bucket string) (*MinIOStorage, error) {
	cleanEndpoint := strings.TrimPrefix(strings.TrimPrefix(endpoint, "http://"), "https://")
	client, err := minio.New(cleanEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: strings.HasPrefix(endpoint, "https://"),
	})
	if err != nil {
		return nil, err
	}
	return &MinIOStorage{client: client, bucket: bucket, publicEndpoint: strings.TrimRight(publicEndpoint, "/")}, nil
}

func (s *MinIOStorage) EnsureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	return s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{})
}

func (s *MinIOStorage) Upload(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) (string, error) {
	if err := s.EnsureBucket(ctx); err != nil {
		return "", err
	}
	_, err := s.client.PutObject(ctx, s.bucket, objectKey, reader, size, minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/%s/%s", s.publicEndpoint, s.bucket, objectKey), nil
}

func (s *MinIOStorage) Bucket() string {
	return s.bucket
}

