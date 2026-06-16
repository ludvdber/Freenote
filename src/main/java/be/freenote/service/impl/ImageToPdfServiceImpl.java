package be.freenote.service.impl;

import be.freenote.exception.FileStorageException;
import be.freenote.exception.PayloadTooLargeException;
import be.freenote.service.ImageToPdfService;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

@Service
public class ImageToPdfServiceImpl implements ImageToPdfService {

    private static final int MAX_IMAGES = 8;
    private static final long MAX_PDF_SIZE = 7 * 1024 * 1024;
    /** Guard against decompression bombs: reject images whose declared resolution is absurd (>40 MP). */
    private static final long MAX_PIXELS = 40_000_000L;
    private static final float JPEG_QUALITY = 0.75f;
    private static final float MARGIN = 18f; // points (~6 mm)
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png");

    @Override
    public byte[] convertToPdf(List<MultipartFile> images) {
        if (images == null || images.isEmpty()) {
            throw new IllegalArgumentException("Aucune image fournie");
        }
        if (images.size() > MAX_IMAGES) {
            throw new IllegalArgumentException("Maximum " + MAX_IMAGES + " images par document");
        }

        try (PDDocument doc = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            for (MultipartFile image : images) {
                if (!ALLOWED_TYPES.contains(image.getContentType())) {
                    throw new IllegalArgumentException("Seules les images JPG et PNG sont acceptées");
                }
                byte[] data = image.getBytes();
                checkDimensions(data);
                BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(data)); // drops EXIF/metadata
                if (decoded == null) {
                    throw new IllegalArgumentException("Image illisible ou corrompue");
                }
                addPage(doc, flatten(decoded));
            }

            doc.save(out);
            byte[] pdf = out.toByteArray();
            if (pdf.length > MAX_PDF_SIZE) {
                throw new PayloadTooLargeException(
                        "Le PDF généré dépasse la limite de 7 Mo — réduis le nombre ou la taille des images");
            }
            return pdf;
        } catch (IOException e) {
            throw new FileStorageException("Impossible de convertir les images en PDF", e);
        }
    }

    /** Reads only the image header to reject over-resolution before allocating a huge BufferedImage. */
    private void checkDimensions(byte[] data) throws IOException {
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("Format d'image non reconnu");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(iis);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels > MAX_PIXELS) {
                    throw new PayloadTooLargeException("Image trop volumineuse (résolution excessive)");
                }
            } finally {
                reader.dispose();
            }
        }
    }

    /** Paint onto an opaque white RGB canvas: removes any alpha channel (so transparent PNGs don't go
     *  black once embedded as JPEG) and guarantees a metadata-free, EXIF-free raster. */
    private BufferedImage flatten(BufferedImage src) {
        BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, rgb.getWidth(), rgb.getHeight());
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return rgb;
    }

    private void addPage(PDDocument doc, BufferedImage img) throws IOException {
        boolean landscape = img.getWidth() > img.getHeight();
        PDRectangle pageSize = landscape
                ? new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth())
                : PDRectangle.A4;
        PDPage page = new PDPage(pageSize);
        doc.addPage(page);

        PDImageXObject pdImage = JPEGFactory.createFromImage(doc, img, JPEG_QUALITY);

        float maxW = pageSize.getWidth() - 2 * MARGIN;
        float maxH = pageSize.getHeight() - 2 * MARGIN;
        float scale = Math.min(maxW / img.getWidth(), maxH / img.getHeight());
        if (scale > 1f) {
            scale = 1f; // never upscale a small image
        }
        float drawW = img.getWidth() * scale;
        float drawH = img.getHeight() * scale;
        float x = (pageSize.getWidth() - drawW) / 2;
        float y = (pageSize.getHeight() - drawH) / 2;

        try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
            cs.drawImage(pdImage, x, y, drawW, drawH);
        }
    }
}
