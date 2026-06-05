package be.freenote.dto.response;

import java.util.List;

public record NewsItem(
        String id,
        String title,
        String date,
        List<String> labels,
        String url,
        String content
) {}
