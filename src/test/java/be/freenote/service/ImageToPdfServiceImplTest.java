package be.freenote.service;

import be.freenote.exception.PayloadTooLargeException;
import be.freenote.service.impl.ImageToPdfServiceImpl;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageToPdfServiceImplTest {

    private final ImageToPdfServiceImpl service = new ImageToPdfServiceImpl();

    private static final byte[] PDF_MAGIC = {0x25, 0x50, 0x44, 0x46, 0x2D}; // %PDF-

    private byte[] image(int w, int h, String format) throws IOException {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, w, h);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    private MultipartFile png(int w, int h) throws IOException {
        return new MockMultipartFile("images", "p.png", "image/png", image(w, h, "png"));
    }

    private MultipartFile jpg(int w, int h) throws IOException {
        return new MockMultipartFile("images", "p.jpg", "image/jpeg", image(w, h, "jpg"));
    }

    @Test
    void shouldAssembleSingleImageIntoOnePagePdf() throws IOException {
        byte[] pdf = service.convertToPdf(List.of(png(600, 800)));

        assertThat(pdf).isNotEmpty();
        assertThat(java.util.Arrays.copyOf(pdf, 5)).isEqualTo(PDF_MAGIC);
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertThat(doc.getNumberOfPages()).isEqualTo(1);
        }
    }

    @Test
    void shouldAssembleMultipleImagesOnePageEach() throws IOException {
        // Mix of orientations + both formats — each becomes one A4 page.
        byte[] pdf = service.convertToPdf(List.of(png(600, 800), jpg(1000, 700), png(400, 400)));

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertThat(doc.getNumberOfPages()).isEqualTo(3);
        }
    }

    @Test
    void shouldRejectEmptyList() {
        assertThatThrownBy(() -> service.convertToPdf(List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRejectNullList() {
        assertThatThrownBy(() -> service.convertToPdf(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRejectMoreThanEightImages() throws IOException {
        List<MultipartFile> nine = new ArrayList<>();
        for (int i = 0; i < 9; i++) nine.add(png(100, 100));

        assertThatThrownBy(() -> service.convertToPdf(nine))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Maximum");
    }

    @Test
    void shouldAcceptExactlyEightImages() throws IOException {
        List<MultipartFile> eight = new ArrayList<>();
        for (int i = 0; i < 8; i++) eight.add(png(120, 120));

        byte[] pdf = service.convertToPdf(eight);
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertThat(doc.getNumberOfPages()).isEqualTo(8);
        }
    }

    @Test
    void shouldRejectNonImageContentType() {
        MultipartFile fake = new MockMultipartFile("images", "x.pdf", "application/pdf", new byte[]{1, 2, 3});

        assertThatThrownBy(() -> service.convertToPdf(List.of(fake)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JPG");
    }

    @Test
    void shouldRejectCorruptImageBytes() {
        // Declared as PNG but the bytes are not a real image → no ImageIO reader.
        MultipartFile garbage = new MockMultipartFile("images", "x.png", "image/png", "not an image".getBytes());

        assertThatThrownBy(() -> service.convertToPdf(List.of(garbage)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRejectImageWithExcessiveResolution() {
        // Craft a PNG header declaring 8000x8000 (= 64 MP > 24 MP cap). The dimension guard reads the
        // IHDR only (no pixel decode), so we never allocate a huge raster in the test either.
        MultipartFile huge = new MockMultipartFile("images", "big.png", "image/png", pngHeader(8000, 8000));

        assertThatThrownBy(() -> service.convertToPdf(List.of(huge)))
                .isInstanceOf(PayloadTooLargeException.class);
    }

    @Test
    void shouldDownsampleOversizedImageToValidPdf() throws IOException {
        // 7020-px long side (> 2×3508) triggers source sub-sampling (factor 2) at decode time —
        // the full-res raster is never held in memory. Still under the 24 MP cap, so it's accepted
        // and produces a valid single-page PDF.
        byte[] pdf = service.convertToPdf(List.of(jpg(7020, 800)));

        assertThat(pdf).isNotEmpty();
        assertThat(java.util.Arrays.copyOf(pdf, 5)).isEqualTo(PDF_MAGIC);
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertThat(doc.getNumberOfPages()).isEqualTo(1);
        }
    }

    /** Minimal PNG (signature + IHDR + IEND) — enough for ImageIO to report width/height. */
    private byte[] pngHeader(int w, int h) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            out.write(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
            byte[] ihdr = new byte[13];
            ihdr[0] = (byte) (w >>> 24); ihdr[1] = (byte) (w >>> 16); ihdr[2] = (byte) (w >>> 8); ihdr[3] = (byte) w;
            ihdr[4] = (byte) (h >>> 24); ihdr[5] = (byte) (h >>> 16); ihdr[6] = (byte) (h >>> 8); ihdr[7] = (byte) h;
            ihdr[8] = 8;  // bit depth
            ihdr[9] = 2;  // colour type: truecolour (RGB)
            writeChunk(out, "IHDR", ihdr);
            writeChunk(out, "IEND", new byte[0]);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        return out.toByteArray();
    }

    private void writeChunk(ByteArrayOutputStream out, String type, byte[] data) throws IOException {
        int len = data.length;
        out.write(new byte[]{(byte) (len >>> 24), (byte) (len >>> 16), (byte) (len >>> 8), (byte) len});
        byte[] typeBytes = type.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        out.write(typeBytes);
        out.write(data);
        java.util.zip.CRC32 crc = new java.util.zip.CRC32();
        crc.update(typeBytes);
        crc.update(data);
        long c = crc.getValue();
        out.write(new byte[]{(byte) (c >>> 24), (byte) (c >>> 16), (byte) (c >>> 8), (byte) c});
    }

    @Test
    void shouldProduceValidPdfForEveryAcceptedCount() {
        // Smoke: 1..8 images all yield a loadable PDF with the matching page count.
        IntStream.rangeClosed(1, 8).forEach(n -> {
            try {
                List<MultipartFile> imgs = new ArrayList<>();
                for (int i = 0; i < n; i++) imgs.add(png(100, 100));
                try (PDDocument doc = Loader.loadPDF(service.convertToPdf(imgs))) {
                    assertThat(doc.getNumberOfPages()).isEqualTo(n);
                }
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        });
    }
}
