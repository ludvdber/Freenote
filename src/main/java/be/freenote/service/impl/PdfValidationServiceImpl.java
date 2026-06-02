package be.freenote.service.impl;

import be.freenote.exception.FileStorageException;
import be.freenote.exception.PayloadTooLargeException;
import be.freenote.service.PdfValidationService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;

@Service
public class PdfValidationServiceImpl implements PdfValidationService {

    private static final long MAX_FILE_SIZE = 7 * 1024 * 1024;
    private static final String PDF_CONTENT_TYPE = "application/pdf";
    private static final byte[] PDF_MAGIC = {0x25, 0x50, 0x44, 0x46, 0x2D};

    @Override
    public byte[] validate(MultipartFile file) {
        if (!PDF_CONTENT_TYPE.equals(file.getContentType())) {
            throw new IllegalArgumentException("Only PDF files are accepted");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new PayloadTooLargeException("File size exceeds the 7 MB limit");
        }

        byte[] pdfBytes;
        try {
            pdfBytes = file.getBytes();
        } catch (IOException e) {
            throw new FileStorageException("Impossible de lire le fichier uploadé", e);
        }

        if (pdfBytes.length < 5 || !Arrays.equals(PDF_MAGIC, 0, 5, pdfBytes, 0, 5)) {
            throw new IllegalArgumentException("Le fichier n'est pas un PDF valide");
        }

        return pdfBytes;
    }
}
