package be.freenote.service;

import be.freenote.enums.ActivityType;
import be.freenote.repository.ActivityLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/** Une panne qui se répète (une erreur 500 par requête) ne doit laisser qu'UNE ligne par jour. */
@ExtendWith(MockitoExtension.class)
class SystemAlertServiceTest {

    @Mock private ActivityLogService activityLogService;
    @Mock private ActivityLogRepository activityLogRepository;
    @Mock private StringRedisTemplate redisTemplate;

    @InjectMocks private SystemAlertService service;

    @Test
    void uneLigneParJourEtParPanne() {
        service.raise("discord", "401");
        service.raise("discord", "401 encore");
        service.raise("kofi", "jeton");

        verify(activityLogService).log(eq(ActivityType.SYSTEM_ALERT), isNull(), eq("Système"), eq("[discord] 401"));
        verify(activityLogService, times(2)).log(eq(ActivityType.SYSTEM_ALERT), any(), anyString(), anyString());
    }
}
