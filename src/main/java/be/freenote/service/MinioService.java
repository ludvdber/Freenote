package be.freenote.service;

import java.io.InputStream;

public interface MinioService {
    void initBucket();
    String upload(String objectKey, InputStream stream, long size, String contentType);
    byte[] download(String objectKey);
    void delete(String objectKey);

    /** Sonde du pane Système : le bucket répond. Ne lève jamais. */
    boolean isReachable();
}
