package be.freenote.service.impl;

import be.freenote.exception.FileStorageException;
import be.freenote.exception.PayloadTooLargeException;
import be.freenote.service.ImageToPdfService;
import com.drew.imaging.ImageMetadataReader;
import com.drew.metadata.Metadata;
import com.drew.metadata.exif.ExifIFD0Directory;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

@Service
public class ImageToPdfServiceImpl implements ImageToPdfService {

    static final int MAX_IMAGES = 8;
    private static final long MAX_PDF_SIZE = 7 * 1024 * 1024;
    /** Header-only guard against decompression bombs: reject images declaring an absurd resolution. */
    static final long MAX_PIXELS = 24_000_000L; // 24 MP — covers any phone/camera, rejects bombs
    /** Downscale so the long side never exceeds A4 @ ~300 dpi — caps memory and output size. */
    static final int MAX_LONG_SIDE = 3508;
    private static final float JPEG_QUALITY = 0.78f;
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
                int orientation = readOrientation(data);
                // One step: decode → apply EXIF orientation → downscale → flatten onto white (RGB, EXIF-free).
                addPage(doc, prepare(data, orientation));
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

    /** Reads only the image header: rejects over-resolution before allocating a huge BufferedImage,
     *  and checks the REAL sniffed format — the Content-Type check above is declarative only (a GIF
     *  claiming image/png would otherwise be decoded by whichever reader matches its magic bytes). */
    private void checkDimensions(byte[] data) throws IOException {
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("Format d'image non reconnu");
            }
            ImageReader reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
                if (!"jpeg".equals(format) && !"png".equals(format)) {
                    throw new IllegalArgumentException("Seules les images JPG et PNG sont acceptées");
                }
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

    /** EXIF Orientation (1–8), defaulting to 1 (normal) for PNGs or JPEGs without the tag. */
    static int readOrientation(byte[] data) {
        try {
            Metadata metadata = ImageMetadataReader.readMetadata(new ByteArrayInputStream(data));
            ExifIFD0Directory dir = metadata.getFirstDirectoryOfType(ExifIFD0Directory.class);
            if (dir != null && dir.containsTag(ExifIFD0Directory.TAG_ORIENTATION)) {
                int orientation = dir.getInt(ExifIFD0Directory.TAG_ORIENTATION);
                if (orientation >= 1 && orientation <= 8) {
                    return orientation;
                }
            }
        } catch (Exception ignored) {
            // No/unreadable EXIF → treat as normal orientation.
        }
        return 1;
    }

    /** Final raster dimensions after applying the orientation swap and the A4@300dpi downscale. */
    static int[] targetDimensions(int width, int height, int orientation) {
        boolean swap = orientation >= 5 && orientation <= 8; // 5–8 rotate by ±90°, swapping axes
        int orientedW = swap ? height : width;
        int orientedH = swap ? width : height;
        double scale = Math.min(1.0, (double) MAX_LONG_SIDE / Math.max(orientedW, orientedH));
        return new int[] {
                Math.max(1, (int) Math.round(orientedW * scale)),
                Math.max(1, (int) Math.round(orientedH * scale)),
        };
    }

    private BufferedImage prepare(byte[] data, int orientation) throws IOException {
        BufferedImage src = decodeDownsampled(data);
        if (src == null) {
            throw new IllegalArgumentException("Image illisible ou corrompue");
        }
        int[] dims = targetDimensions(src.getWidth(), src.getHeight(), orientation);
        BufferedImage out = new BufferedImage(dims[0], dims[1], BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        // White background (so transparent PNGs don't go black once embedded as JPEG).
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, dims[0], dims[1]);
        g.setTransform(combinedTransform(orientation, src.getWidth(), src.getHeight()));
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    /**
     * Decodes the image while <b>sub-sampling at the source</b>, so an over-sized photo never
     * materialises as a full-resolution {@link BufferedImage} in the heap. We pick the largest
     * integer factor {@code k} such that {@code longSide/k} is still ≥ {@link #MAX_LONG_SIDE}
     * (never decode below the target, to keep quality), then {@link #prepare} does the fine downscale.
     * Example: a 24 MP 8000×3000 panorama decodes at ~4000×1500 (≈4× less heap) instead of full size.
     * Sub-sampling is a pure resolution reduction — orientation-agnostic — so the EXIF rotation applied
     * afterwards in {@link #prepare} is unaffected. Malformed pixel data surfaces as a 400 (illisible),
     * matching the previous {@code ImageIO.read == null} behaviour.
     */
    private BufferedImage decodeDownsampled(byte[] data) throws IOException {
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(iis, true, true);
                int srcLong = Math.max(reader.getWidth(0), reader.getHeight(0));
                int sub = Math.max(1, srcLong / MAX_LONG_SIDE);
                ImageReadParam param = reader.getDefaultReadParam();
                if (sub > 1) {
                    param.setSourceSubsampling(sub, sub, 0, 0);
                }
                return reader.read(0, param);
            } catch (IOException | RuntimeException e) {
                // Truncated / malformed pixel data (header parsed fine in checkDimensions, body didn't).
                throw new IllegalArgumentException("Image illisible ou corrompue");
            } finally {
                reader.dispose();
            }
        }
    }

    /** Orientation correction followed by the uniform downscale, as a single affine transform. */
    private AffineTransform combinedTransform(int orientation, int width, int height) {
        boolean swap = orientation >= 5 && orientation <= 8;
        int orientedLong = Math.max(swap ? height : width, swap ? width : height);
        double scale = Math.min(1.0, (double) MAX_LONG_SIDE / orientedLong);
        AffineTransform t = AffineTransform.getScaleInstance(scale, scale);
        t.concatenate(orientationTransform(orientation, width, height));
        return t;
    }

    /** Canonical EXIF-orientation affine for a source of size width×height (maps source → display). */
    private AffineTransform orientationTransform(int orientation, int width, int height) {
        AffineTransform t = new AffineTransform();
        switch (orientation) {
            case 2 -> { t.scale(-1, 1); t.translate(-width, 0); }
            case 3 -> { t.translate(width, height); t.rotate(Math.PI); }
            case 4 -> { t.scale(1, -1); t.translate(0, -height); }
            case 5 -> { t.rotate(Math.PI / 2); t.scale(1, -1); }
            case 6 -> { t.translate(height, 0); t.rotate(Math.PI / 2); }
            case 7 -> { t.scale(-1, 1); t.translate(-height, 0); t.translate(0, width); t.rotate(3 * Math.PI / 2); }
            case 8 -> { t.translate(0, width); t.rotate(3 * Math.PI / 2); }
            default -> { /* 1 = identity */ }
        }
        return t;
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
