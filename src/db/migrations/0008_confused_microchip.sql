CREATE TABLE "drive_reader_grants" (
	"folder_id" text NOT NULL,
	"email" text NOT NULL,
	"permission_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_reader_grants_folder_id_email_pk" PRIMARY KEY("folder_id","email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "drive_reader_grants_permission_unique" ON "drive_reader_grants" USING btree ("folder_id","permission_id");