package be.freenote.service;

import be.freenote.dto.response.CountdownResponse;
import be.freenote.entity.AppSetting;
import be.freenote.repository.AppSettingRepository;
import be.freenote.service.impl.SettingsServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SettingsServiceImplTest {

    @Mock private AppSettingRepository appSettingRepository;

    @InjectMocks private SettingsServiceImpl settingsService;

    private static AppSetting setting(String key, String value) {
        return AppSetting.builder().key(key).value(value).build();
    }

    @Test
    void shouldReturnEmptyCountdownWhenNotConfigured() {
        when(appSettingRepository.findById("countdown.date")).thenReturn(Optional.empty());

        CountdownResponse result = settingsService.getCountdown();

        assertThat(result.date()).isNull();
        assertThat(result.label()).isNull();
    }

    @Test
    void shouldReturnConfiguredCountdown() {
        when(appSettingRepository.findById("countdown.date"))
                .thenReturn(Optional.of(setting("countdown.date", "2026-09-07")));
        when(appSettingRepository.findById("countdown.label"))
                .thenReturn(Optional.of(setting("countdown.label", "Rentrée 2026")));

        CountdownResponse result = settingsService.getCountdown();

        assertThat(result.date()).isEqualTo(LocalDate.of(2026, 9, 7));
        assertThat(result.label()).isEqualTo("Rentrée 2026");
    }

    @Test
    void shouldDisableCountdownWhenStoredDateIsCorrupt() {
        // Une valeur illisible (édition SQL manuelle) masque la bannière au lieu de casser la home.
        when(appSettingRepository.findById("countdown.date"))
                .thenReturn(Optional.of(setting("countdown.date", "pas-une-date")));

        CountdownResponse result = settingsService.getCountdown();

        assertThat(result.date()).isNull();
    }

    @Test
    void shouldUpsertCountdownKeys() {
        when(appSettingRepository.findById("countdown.date")).thenReturn(Optional.empty());
        when(appSettingRepository.findById("countdown.label")).thenReturn(Optional.empty());

        settingsService.setCountdown(LocalDate.of(2026, 9, 7), "  Rentrée 2026  ");

        var captor = org.mockito.ArgumentCaptor.forClass(AppSetting.class);
        verify(appSettingRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues())
                .anySatisfy(s -> {
                    assertThat(s.getKey()).isEqualTo("countdown.date");
                    assertThat(s.getValue()).isEqualTo("2026-09-07");
                })
                .anySatisfy(s -> {
                    assertThat(s.getKey()).isEqualTo("countdown.label");
                    assertThat(s.getValue()).isEqualTo("Rentrée 2026"); // trimé
                });
    }

    @Test
    void shouldClearCountdownWhenDateIsNull() {
        settingsService.setCountdown(null, "peu importe");

        verify(appSettingRepository).deleteById("countdown.date");
        verify(appSettingRepository).deleteById("countdown.label");
        verify(appSettingRepository, never()).save(any());
    }

    // ---- Coût mensuel (thermomètre) ----

    @Test
    void shouldReturnNullFundingCostWhenNotConfigured() {
        when(appSettingRepository.findById("funding.monthly-cost")).thenReturn(Optional.empty());

        assertThat(settingsService.getFundingCost()).isNull();
    }

    @Test
    void shouldReturnConfiguredFundingCost() {
        when(appSettingRepository.findById("funding.monthly-cost"))
                .thenReturn(Optional.of(setting("funding.monthly-cost", "5.00")));

        assertThat(settingsService.getFundingCost()).isEqualByComparingTo("5.00");
    }

    @Test
    void shouldDisableFundingWhenStoredCostIsCorrupt() {
        when(appSettingRepository.findById("funding.monthly-cost"))
                .thenReturn(Optional.of(setting("funding.monthly-cost", "abc")));

        assertThat(settingsService.getFundingCost()).isNull();
    }

    @Test
    void shouldUpsertAndClearFundingCost() {
        when(appSettingRepository.findById("funding.monthly-cost")).thenReturn(Optional.empty());

        settingsService.setFundingCost(new java.math.BigDecimal("4.50"));
        var captor = org.mockito.ArgumentCaptor.forClass(AppSetting.class);
        verify(appSettingRepository).save(captor.capture());
        assertThat(captor.getValue().getKey()).isEqualTo("funding.monthly-cost");
        assertThat(captor.getValue().getValue()).isEqualTo("4.50");

        settingsService.setFundingCost(null);
        verify(appSettingRepository).deleteById("funding.monthly-cost");
    }
}
