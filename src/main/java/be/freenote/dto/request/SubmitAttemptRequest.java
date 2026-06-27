package be.freenote.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * A finished play submitted for grading. {@code answers} holds the chosen 0-based choice index per
 * question (a {@code null} entry = skipped); the server re-grades against the stored answers, so the
 * client never sends a score. {@code durationMs} is client-measured (low-stakes) and clamped server-side.
 */
public record SubmitAttemptRequest(
        @NotNull @Size(max = 100) List<Integer> answers,
        @Min(0) long durationMs
) {}
