package be.freenote.service.impl;

import be.freenote.exception.FileStorageException;
import be.freenote.service.MinioService;
import io.minio.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class MinioServiceImpl implements MinioService {

    private final MinioClient minioClient;

    @Value("${app.minio.bucket}")
    private String bucket;

    private static final String PRIVATE_BUCKET_POLICY = """
            {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Deny",
                  "Principal": {"AWS": ["*"]},
                  "Action": ["s3:GetObject"],
                  "Resource": ["arn:aws:s3:::%s/*"]
                }
              ]
            }
            """;

    @PostConstruct
    @Override
    public void initBucket() {
        try {
            boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
            minioClient.setBucketPolicy(SetBucketPolicyArgs.builder()
                    .bucket(bucket)
                    .config(PRIVATE_BUCKET_POLICY.formatted(bucket))
                    .build());
            log.info("MinIO bucket '{}' initialized with private policy", bucket);
        } catch (Exception e) {
            throw new FileStorageException("Failed to initialize MinIO bucket", e);
        }
    }

    @Override
    public String upload(String objectKey, InputStream stream, long size, String contentType) {
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(stream, size, -1L)
                    .contentType(contentType)
                    .build());
            return objectKey;
        } catch (Exception e) {
            log.error("MinIO upload failed: key={}, size={}, error={}", objectKey, size, e.getMessage());
            throw new FileStorageException("Failed to upload file to MinIO", e);
        }
    }

    @Override
    public byte[] download(String objectKey) {
        try (InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                .bucket(bucket)
                .object(objectKey)
                .build())) {
            return stream.readAllBytes();
        } catch (Exception e) {
            throw new FileStorageException("Failed to download file from MinIO", e);
        }
    }

    @Override
    public void delete(String objectKey) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            throw new FileStorageException("Failed to delete file from MinIO", e);
        }
    }

    @Override
    public boolean isReachable() {
        try {
            return minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        } catch (Exception e) {
            return false;
        }
    }
}
