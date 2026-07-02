-- ================================================================
-- V6 — DOCUMENTS.FILE_HASH : détection de doublons par contenu (SHA-256)
-- ================================================================
-- Migration ADDITIVE (après V1..V5). Un seul ALTER ADD COLUMN, nullable :
-- les lignes existantes gardent NULL et sont remplies au démarrage par un
-- backfill asynchrone (DocumentHashBackfill) qui relit chaque PDF depuis MinIO.
--
-- Le hash sert à REFUSER un ré-upload d'un PDF identique (409). PAS de contrainte
-- UNIQUE : d'éventuels doublons DÉJÀ présents en base ne doivent pas faire échouer
-- le backfill ; l'unicité est vérifiée au niveau service AVANT l'insert.
-- VARCHAR(64) et non CHAR(64) : l'entité JPA déclare @Column(length = 64) → varchar attendu
-- par la validation Hibernate (ddl-auto=validate refuse bpchar au boot).
ALTER TABLE documents ADD COLUMN file_hash VARCHAR(64);

CREATE INDEX idx_documents_file_hash ON documents(file_hash);
