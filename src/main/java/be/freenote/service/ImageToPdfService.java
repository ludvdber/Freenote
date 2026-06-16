package be.freenote.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface ImageToPdfService {

    /**
     * Validates JPG/PNG images, strips their metadata (EXIF) and assembles them into a single PDF,
     * one image per A4 page (orientation follows the image aspect ratio).
     *
     * @throws IllegalArgumentException if no image / too many images / an unsupported or unreadable type
     * @throws be.freenote.exception.PayloadTooLargeException if an image is over-sized or the resulting PDF exceeds 7 MB
     */
    byte[] convertToPdf(List<MultipartFile> images);
}
