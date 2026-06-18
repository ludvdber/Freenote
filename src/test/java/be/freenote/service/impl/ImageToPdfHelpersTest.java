package be.freenote.service.impl;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

/** Unit tests for the orientation/downscale helpers (package-private statics). */
class ImageToPdfHelpersTest {

    private byte[] image(int w, int h, String format) throws IOException {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    @Test
    void targetDimensionsLeavesSmallImagesUntouched() {
        assertThat(ImageToPdfServiceImpl.targetDimensions(600, 800, 1)).containsExactly(600, 800);
    }

    @Test
    void targetDimensionsDownscalesBeyondA4At300Dpi() {
        // 4000x3000 → long side capped at 3508
        assertThat(ImageToPdfServiceImpl.targetDimensions(4000, 3000, 1)).containsExactly(3508, 2631);
    }

    @Test
    void targetDimensionsSwapsAxesForRotatedOrientations() {
        assertThat(ImageToPdfServiceImpl.targetDimensions(600, 800, 6)).containsExactly(800, 600);
        assertThat(ImageToPdfServiceImpl.targetDimensions(600, 800, 8)).containsExactly(800, 600);
        // swap + downscale
        assertThat(ImageToPdfServiceImpl.targetDimensions(4000, 3000, 6)).containsExactly(2631, 3508);
    }

    @Test
    void readOrientationDefaultsToOneWithoutExif() throws IOException {
        assertThat(ImageToPdfServiceImpl.readOrientation(image(50, 50, "png"))).isEqualTo(1);
        assertThat(ImageToPdfServiceImpl.readOrientation(image(50, 50, "jpg"))).isEqualTo(1);
    }

    @Test
    void readOrientationDefaultsToOneForUnreadableData() {
        assertThat(ImageToPdfServiceImpl.readOrientation("not an image".getBytes())).isEqualTo(1);
    }
}
