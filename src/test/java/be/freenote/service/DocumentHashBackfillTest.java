package be.freenote.service;

import be.freenote.entity.Document;
import be.freenote.enums.Category;
import be.freenote.repository.DocumentRepository;
import be.freenote.service.impl.DocumentHashBackfill;
import be.freenote.service.impl.DocumentServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Rattrapage des empreintes SHA-256 des documents déposés avant l'existence de la déduplication.
 * Il tourne à CHAQUE démarrage de l'application (en asynchrone) : une exception non rattrapée sur
 * un seul fichier absent de MinIO doit rester un avertissement, jamais un incident de boot.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DocumentHashBackfillTest {

    @Mock private DocumentRepository documentRepository;
    @Mock private MinioService minioService;

    @InjectMocks private DocumentHashBackfill backfill;

    private static Document doc(long id, String key) {
        return Document.builder().id(id).title("Doc " + id).category(Category.SYNTHESE)
                .fileKey(key).fileSize(10L).build();
    }

    @Test
    void calculeEtEnregistreLEmpreinteDesDocumentsSansHash() {
        Document d = doc(1L, "uuid/a.pdf");
        when(documentRepository.findByFileHashIsNull()).thenReturn(List.of(d));
        when(minioService.download("uuid/a.pdf")).thenReturn("contenu".getBytes(StandardCharsets.UTF_8));
        when(documentRepository.findDuplicateHashes()).thenReturn(List.of());

        backfill.backfill();

        assertThat(d.getFileHash())
                .isEqualTo(DocumentServiceImpl.sha256Hex("contenu".getBytes(StandardCharsets.UTF_8)));
        verify(documentRepository).save(d);
    }

    /** Idempotence : plus rien à traiter aux redémarrages suivants. */
    @Test
    void neFaitRienQuandToutEstDejaHashe() {
        when(documentRepository.findByFileHashIsNull()).thenReturn(List.of());
        when(documentRepository.findDuplicateHashes()).thenReturn(List.of());

        backfill.backfill();

        verify(minioService, never()).download(any());
        verify(documentRepository, never()).save(any());
    }

    /**
     * Un objet manquant dans MinIO (fichier supprimé à la main, migration ratée) ne doit pas
     * interrompre le rattrapage : les documents suivants sont quand même traités.
     */
    @Test
    void poursuitLeTraitementApresUnFichierIntrouvable() {
        Document ko = doc(1L, "uuid/manquant.pdf");
        Document ok = doc(2L, "uuid/b.pdf");
        when(documentRepository.findByFileHashIsNull()).thenReturn(List.of(ko, ok));
        when(minioService.download("uuid/manquant.pdf")).thenThrow(new RuntimeException("NoSuchKey"));
        when(minioService.download("uuid/b.pdf")).thenReturn("b".getBytes(StandardCharsets.UTF_8));
        when(documentRepository.findDuplicateHashes()).thenReturn(List.of());

        assertThatCode(() -> backfill.backfill()).doesNotThrowAnyException();

        assertThat(ko.getFileHash()).isNull();
        assertThat(ok.getFileHash()).isNotNull();
        verify(documentRepository).save(ok);
        verify(documentRepository, never()).save(ko);
    }

    /**
     * Les doublons déjà présents sont SIGNALÉS, jamais supprimés automatiquement : c'est un admin
     * qui décide lequel garder (deux dépôts identiques peuvent avoir des auteurs différents).
     */
    @Test
    void signaleLesDoublonsExistantsSansRienSupprimer() {
        when(documentRepository.findByFileHashIsNull()).thenReturn(List.of());
        when(documentRepository.findDuplicateHashes()).thenReturn(List.of("hash-a"));
        when(documentRepository.findAllByFileHash("hash-a")).thenReturn(List.of(doc(1L, "a"), doc(2L, "b")));

        backfill.backfill();

        verify(documentRepository).findAllByFileHash("hash-a");
        verify(documentRepository, never()).delete(any());
        verify(documentRepository, never()).deleteAll(any());
    }

    @Test
    void hasheEtSignaleLesDoublonsDansLeMemePassage() {
        Document d = doc(1L, "uuid/a.pdf");
        when(documentRepository.findByFileHashIsNull()).thenReturn(List.of(d));
        when(minioService.download("uuid/a.pdf")).thenReturn("x".getBytes(StandardCharsets.UTF_8));
        when(documentRepository.findDuplicateHashes()).thenReturn(List.of("h1", "h2"));
        when(documentRepository.findAllByFileHash(any())).thenReturn(List.of(doc(1L, "a"), doc(2L, "b")));

        backfill.backfill();

        verify(documentRepository).save(d);
        verify(documentRepository).findAllByFileHash("h1");
        verify(documentRepository).findAllByFileHash("h2");
    }
}
