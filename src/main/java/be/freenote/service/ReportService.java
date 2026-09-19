package be.freenote.service;

import be.freenote.dto.request.ReportRequest;
import be.freenote.dto.request.ResolveReportRequest;
import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.ReportResponse;
import be.freenote.enums.ReportStatus;
import be.freenote.enums.ReportType;
import org.springframework.data.domain.Pageable;

import java.util.Map;

public interface ReportService {

    void create(Long userId, Long documentId, ReportRequest request);

    /** File de modération. {@code status}/{@code type} null = pas de filtre sur ce critère. */
    PageResponse<ReportResponse> list(ReportStatus status, ReportType type, Pageable pageable);

    /** Nombre de signalements EN ATTENTE par type — compteurs des chips de filtre du panel. */
    Map<String, Long> pendingCountsByType();

    /**
     * Tranche un signalement <strong>en agissant vraiment</strong> : selon la résolution demandée,
     * retire la vérification du document ou le supprime, puis notifie le signaleur (et l'auteur du
     * document quand celui-ci est touché). Tranche du même coup les autres signalements en attente
     * visant le même document.
     *
     * @param adminId le modérateur qui décide — tracé dans {@code resolved_by}
     */
    void decide(Long reportId, Long adminId, ResolveReportRequest request);
}
