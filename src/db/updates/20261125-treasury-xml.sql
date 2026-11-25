BEGIN;

ALTER TABLE sale_documents
  ADD COLUMN mime_type text NOT NULL DEFAULT 'application/pdf',
  ADD CONSTRAINT sale_documents_mime_type CHECK (mime_type IN ('application/pdf', 'application/xml'));

ALTER TABLE caja_requests
  ADD COLUMN draft_xml_document_id uuid,
  ADD COLUMN finalized_xml_document_id uuid,
  ADD CONSTRAINT caja_requests_draft_xml_document_id_sale_documents_id_fk
    FOREIGN KEY (draft_xml_document_id) REFERENCES sale_documents(id) ON DELETE RESTRICT,
  ADD CONSTRAINT caja_requests_finalized_xml_document_id_sale_documents_id_fk
    FOREIGN KEY (finalized_xml_document_id) REFERENCES sale_documents(id) ON DELETE RESTRICT;

COMMIT;
