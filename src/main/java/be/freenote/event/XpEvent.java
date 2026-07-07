package be.freenote.event;

import java.util.List;

/**
 * Sealed hierarchy for all XP-affecting events.
 * A single listener handles the dispatch — XP rules live in one place.
 */
public sealed interface XpEvent {

    Long authorId();

    /** Document verified by admin → author earns XP. */
    record DocumentVerified(Long authorId, Long documentId, String title) implements XpEvent {}

    /** Verification revoked by admin → the verification XP is taken back (re-verify must be net zero). */
    record DocumentUnverified(Long authorId, Long documentId) implements XpEvent {}

    /** Document downloaded → author earns XP (unless self-download; deduped per user/24h upstream). */
    record DocumentDownloaded(Long authorId, Long documentId) implements XpEvent {}

    /** Document rated (new rating or re-rating) → author XP adjusts to the new score.
     *  {@code previousScore} is null for a first-time rating. */
    record DocumentRated(Long authorId, Long documentId, int score, Integer previousScore) implements XpEvent {}

    /** First rating a user gives on a document → the RATER earns XP (règle validée 2026-07-07 :
     *  motiver la notation). Émis à la création du Rating uniquement — re-noter n'en redonne pas
     *  (l'unicité (document, user) de la table rend la règle anti-farm par construction). */
    record RatingGiven(Long raterId, Long documentId) implements XpEvent {
        /** Le « bénéficiaire XP » de cet événement est le noteur, pas l'auteur du doc. */
        @Override
        public Long authorId() {
            return raterId;
        }
    }

    /** Document deleted → author loses the XP the document had earned (verification + ratings).
     *  {@code ratingScores} = the scores present at deletion time. Download XP is not clawed back
     *  (no per-download history is stored — accepted drift). */
    record DocumentDeleted(Long authorId, Long documentId, boolean wasVerified,
                           List<Integer> ratingScores) implements XpEvent {}
}
