package be.freenote.service;

import org.springframework.security.oauth2.core.user.OAuth2User;

public interface AuthService {
    void processOAuth2Login(OAuth2User oAuth2User, String registrationId);
    void requestVerification(Long userId, String email);
    String confirmVerification(Long userId, String code);
}
