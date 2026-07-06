package be.freenote.service;

public interface RatingService {
    void rate(Long userId, Long documentId, int score);
    Double getAverageRating(Long documentId);
    /** Note posée par cet utilisateur sur ce document, 0 s'il n'a pas encore voté. */
    int getUserScore(Long userId, Long documentId);
}
