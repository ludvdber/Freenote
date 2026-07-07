package be.freenote.service.impl;

import be.freenote.dto.response.CountdownResponse;
import be.freenote.entity.AppSetting;
import be.freenote.repository.AppSettingRepository;
import be.freenote.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SettingsServiceImpl implements SettingsService {

    private static final String COUNTDOWN_DATE = "countdown.date";
    private static final String COUNTDOWN_LABEL = "countdown.label";

    private final AppSettingRepository appSettingRepository;

    @Override
    public CountdownResponse getCountdown() {
        LocalDate date = appSettingRepository.findById(COUNTDOWN_DATE)
                .map(AppSetting::getValue)
                .map(v -> {
                    // Une valeur corrompue (édition SQL manuelle) désactive la bannière au lieu de
                    // casser la home publique.
                    try {
                        return LocalDate.parse(v);
                    } catch (DateTimeParseException e) {
                        return null;
                    }
                })
                .orElse(null);
        if (date == null) {
            return new CountdownResponse(null, null);
        }
        String label = appSettingRepository.findById(COUNTDOWN_LABEL)
                .map(AppSetting::getValue)
                .orElse(null);
        return new CountdownResponse(date, label);
    }

    @Override
    @Transactional
    public void setCountdown(LocalDate date, String label) {
        if (date == null) {
            appSettingRepository.deleteById(COUNTDOWN_DATE);
            appSettingRepository.deleteById(COUNTDOWN_LABEL);
            return;
        }
        set(COUNTDOWN_DATE, date.toString());
        set(COUNTDOWN_LABEL, label == null ? null : label.trim());
    }

    private void set(String key, String value) {
        AppSetting setting = appSettingRepository.findById(key)
                .orElseGet(() -> AppSetting.builder().key(key).build());
        setting.setValue(value);
        appSettingRepository.save(setting);
    }
}
