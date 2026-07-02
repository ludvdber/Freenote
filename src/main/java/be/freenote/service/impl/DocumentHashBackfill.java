package be.freenote.service.impl;

import be.freenote.entity.Document;
import be.freenote.repository.DocumentRepository;
import be.freenote.service.MinioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * One-time backfill of {@code documents.file_hash} for rows uploaded before hashing existed. Runs
 * asynchronously once the app is ready (never blocks boot), re-reading each PDF from MinIO to compute
 * its SHA-256, so duplicate detection also protects against re-uploading a pre-existing document.
 * Idempotent: only touches rows where the hash is still NULL, so subsequent restarts do nothing.
 * Excluded from the {@code test} profile (integration tests manage their own data).
 */
@Slf4j
@Component
@Profile("!test")
@RequiredArgsConstructor
public class DocumentHashBackfill {

    private final DocumentRepository documentRepository;
    private final MinioService minioService;

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void backfill() {
        List<Document> pending = documentRepository.findByFileHashIsNull();
        if (!pending.isEmpty()) {
            log.info("Document hash backfill: {} document(s) to process", pending.size());
            int done = 0;
            int failed = 0;
            for (Document doc : pending) {
                try {
                    byte[] bytes = minioService.download(doc.getFileKey());
                    doc.setFileHash(DocumentServiceImpl.sha256Hex(bytes));
                    documentRepository.save(doc);
                    done++;
                } catch (Exception e) {
                    failed++;
                    log.warn("Hash backfill failed for document id={} (key={}): {}",
                            doc.getId(), doc.getFileKey(), e.getMessage());
                }
            }
            log.info("Document hash backfill done: {} hashed, {} failed", done, failed);
        }

        // Report exact duplicates already present (same PDF uploaded more than once before hashing).
        // These are NOT auto-deleted — an admin reviews the logged list and decides what to remove.
        List<String> duplicateHashes = documentRepository.findDuplicateHashes();
        if (duplicateHashes.isEmpty()) {
            return;
        }
        log.warn("Found {} group(s) of duplicate documents (identical PDF content):", duplicateHashes.size());
        for (String hash : duplicateHashes) {
            List<Document> group = documentRepository.findAllByFileHash(hash);
            log.warn("  duplicate group ({} docs): {}", group.size(),
                    group.stream().map(d -> "#" + d.getId() + " \"" + d.getTitle() + "\"").toList());
        }
    }
}
