package be.freenote.event;

/**
 * Sealed hierarchy for all XP-granting events.
 * A single listener handles the dispatch — XP rules live in one place.
 */
public sealed interface XpEvent {

    Long authorId();

    /** Document verified by admin → author earns XP. */
    record DocumentVerified(Long authorId, Long documentId, String title) implements XpEvent {}

    /** Document downloaded → author earns XP (unless self-download). */
    record DocumentDownloaded(Long authorId, Long documentId) implements XpEvent {}

    /** Document rated → author earns XP proportional to score. */
    record DocumentRated(Long authorId, Long documentId, int score) implements XpEvent {}
}
