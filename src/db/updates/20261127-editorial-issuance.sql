BEGIN;
SET LOCAL lock_timeout = '10s';

-- Run during the cutover after stopping old requests and permission jobs.
LOCK TABLE authorized_emails, drive_file_reader_grants IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT FROM authorized_emails WHERE role = 'caja') THEN
    RAISE EXCEPTION 'Retira los accesos de Tesorería antes de actualizar el esquema.';
  END IF;
  IF EXISTS (SELECT FROM drive_file_reader_grants) THEN
    RAISE EXCEPTION 'Concilia los permisos de archivos de Tesorería en Drive antes de actualizar.';
  END IF;
END $$;

DROP TABLE drive_file_reader_grants, caja_notifications, treasury_activity,
  treasury_notes, treasury_observations, treasury_supporting_files;

DROP INDEX authorized_emails_caja_imprint_idx;
ALTER TABLE authorized_emails
  DROP CONSTRAINT authorized_emails_role,
  DROP CONSTRAINT authorized_emails_scope,
  DROP CONSTRAINT authorized_emails_master_role,
  DROP CONSTRAINT authorized_emails_treasury_closed,
  DROP COLUMN publisher_imprint,
  DROP COLUMN publisher_imprints,
  DROP COLUMN treasury_service,
  ADD CONSTRAINT authorized_emails_role CHECK (role = 'gestor');

ALTER TABLE caja_requests RENAME TO order_sale_issuances;
DROP INDEX caja_requests_assigned_idx, caja_requests_inbox_idx;
ALTER INDEX caja_requests_order_imprint_unique RENAME TO order_sale_issuances_order_imprint_unique;
ALTER TABLE order_sale_issuances
  DROP CONSTRAINT caja_requests_assignment,
  DROP COLUMN request_number,
  DROP COLUMN assigned_to,
  DROP COLUMN assigned_name,
  DROP COLUMN assigned_at,
  DROP COLUMN assignment_token,
  DROP COLUMN gmail_thread_id,
  DROP COLUMN subject_header,
  DROP COLUMN last_rfc_message_id,
  DROP COLUMN rfc_references,
  DROP COLUMN lease_id,
  DROP COLUMN lease_until;
ALTER TABLE order_sale_issuances RENAME CONSTRAINT caja_requests_pkey TO order_sale_issuances_pkey;
ALTER TABLE order_sale_issuances RENAME CONSTRAINT caja_requests_state TO order_sale_issuances_state;
ALTER TABLE order_sale_issuances RENAME CONSTRAINT caja_requests_finalized TO order_sale_issuances_finalized;
ALTER TABLE order_sale_issuances RENAME CONSTRAINT caja_requests_order_id_orders_id_fk TO order_sale_issuances_order_id_orders_id_fk;
ALTER TABLE order_sale_issuances RENAME CONSTRAINT caja_requests_draft_document_id_sale_documents_id_fk TO order_sale_issuances_draft_document_id_sale_documents_id_fk;
ALTER TABLE order_sale_issuances RENAME CONSTRAINT caja_requests_finalized_document_id_sale_documents_id_fk TO order_sale_issuances_finalized_document_id_sale_documents_id_fk;
ALTER TABLE order_sale_issuances RENAME CONSTRAINT caja_requests_draft_xml_document_id_sale_documents_id_fk TO order_sale_issuances_draft_xml_document_id_sale_documents_id_fk;
ALTER TABLE order_sale_issuances RENAME CONSTRAINT caja_requests_finalized_xml_document_id_sale_documents_id_fk TO order_sale_issuances_finalized_xml_document_id_sale_documents_id_fk;

ALTER TABLE sale_documents RENAME COLUMN request_id TO issuance_id;
ALTER TABLE sale_documents RENAME CONSTRAINT sale_documents_request_id_caja_requests_id_fk TO sale_documents_issuance_id_order_sale_issuances_id_fk;
ALTER INDEX sale_documents_request_idx RENAME TO sale_documents_issuance_idx;

-- Retain existing document references and register the missing paid seals.
-- This creates no notifications and performs no mail or Drive operations.
INSERT INTO order_sale_issuances (order_id, publisher_imprint)
SELECT id, 'universidad'::publisher_imprint FROM orders
WHERE order_status <> 'CANCELADO' AND payment_status_universidad = 'VERIFICADO'
UNION ALL
SELECT id, 'instituto'::publisher_imprint FROM orders
WHERE order_status <> 'CANCELADO' AND payment_status_instituto = 'VERIFICADO'
ON CONFLICT (order_id, publisher_imprint) DO NOTHING;

CREATE TABLE treasury_payment_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  publisher_imprint publisher_imprint NOT NULL,
  receipt_id uuid NOT NULL,
  recipient text,
  status text NOT NULL DEFAULT 'NO_ENVIADO',
  gmail_message_id text,
  gmail_thread_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT treasury_payment_notices_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT treasury_payment_notices_receipt_id_payment_receipts_id_fk FOREIGN KEY (receipt_id) REFERENCES payment_receipts(id) ON DELETE RESTRICT,
  CONSTRAINT treasury_payment_notices_status CHECK (status IN ('NO_ENVIADO','ENVIANDO','ENVIADO','ERROR','INCIERTO','OMITIDO'))
);
CREATE UNIQUE INDEX treasury_payment_notices_order_imprint_unique ON treasury_payment_notices (order_id, publisher_imprint);

COMMIT;
