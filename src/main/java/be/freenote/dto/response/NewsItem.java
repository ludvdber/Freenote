package be.freenote.dto.response;

import java.util.List;

public record NewsItem(
        String id,
        String title,
        String date,
        List<String> labels,
        String url,
        String content,
        /** URL of the first image found in the post content, for the /news magazine thumbnails.
         *  Null when the post has no image. Hosts are covered by the CSP img-src whitelist
         *  (*.blogspot.com / *.googleusercontent.com). */
        String thumbnail
) {}
