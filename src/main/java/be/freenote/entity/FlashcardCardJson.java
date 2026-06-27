package be.freenote.entity;

/**
 * One card as stored inside the {@code flashcard_decks.cards} JSONB array. Plain text (front/back) —
 * React escapes at render, consistent with document titles (no escape-on-write).
 */
public record FlashcardCardJson(String front, String back) {}
