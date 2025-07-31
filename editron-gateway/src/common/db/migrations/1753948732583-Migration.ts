import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1753948732583 implements MigrationInterface {
    name = 'Migration1753948732583'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "email" character varying, "name" character varying NOT NULL, "personal_number" character varying, "profile_picture" character varying, "google_id" character varying, "facebook_id" character varying, "google_access_token" character varying, "google_refresh_token" character varying, "google_token_expiry" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_0bd5012aeb82628e07f6a1be53b" UNIQUE ("google_id"), CONSTRAINT "UQ_df199bc6e53abe32d64bbcf2110" UNIQUE ("facebook_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_files" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "original_file_name" character varying(255) NOT NULL, "storage_key" character varying(500) NOT NULL, "storage_bucket" character varying(100) NOT NULL, "mime_type" character varying(100) NOT NULL, "size" character varying NOT NULL, "status" "public"."user_files_status_enum" NOT NULL DEFAULT 'UPLOADING', "user_id" integer NOT NULL, CONSTRAINT "UQ_86af309a58b66f5aa88fc3ce4fe" UNIQUE ("uuid"), CONSTRAINT "PK_a62f81d2afadf20a024e11b43bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8d2cd7418269ab5f7e29926cb1" ON "user_files" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "projects" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "custom_instructions" text, "user_id" integer NOT NULL, CONSTRAINT "UQ_fc9f1e64d4626f18beff534a9f3" UNIQUE ("uuid"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bd55b203eb9f92b0c839038001" ON "projects" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "documents" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "content" text NOT NULL, "status" "public"."documents_status_enum" NOT NULL DEFAULT 'PROCESSING', "user_id" integer NOT NULL, "project_id" integer NOT NULL, "source_file_id" integer, CONSTRAINT "UQ_f6ab4fff7a383f1f14013ab270b" UNIQUE ("uuid"), CONSTRAINT "REL_71d739ec6ca8fbcb3adde0bbe3" UNIQUE ("source_file_id"), CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c7481daf5059307842edef74d7" ON "documents" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e156b298c20873e14c362e789b" ON "documents" ("project_id") `);
        await queryRunner.query(`CREATE TABLE "knowledge_items" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "chunk_index" integer NOT NULL, "content" text NOT NULL, "embedding" text, "metadata" jsonb, "content_tsvector" text, "user_id" integer NOT NULL, "project_id" integer NOT NULL, "document_id" integer NOT NULL, CONSTRAINT "PK_4da6043fefe372aa8151664e3b2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_32a09bcb80f407e783bbad6221" ON "knowledge_items" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_714e902e9185a3f368914902ed" ON "knowledge_items" ("project_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_85116821114f7c410ac4e2b943" ON "knowledge_items" ("document_id") `);
        await queryRunner.query(`CREATE TABLE "chat_messages" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "role" "public"."chat_messages_role_enum" NOT NULL, "content" text NOT NULL, "tokens" integer NOT NULL DEFAULT '0', "user_id" integer NOT NULL, CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5588b6cea298cedec7063c0d33" ON "chat_messages" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "user_files" ADD CONSTRAINT "FK_8d2cd7418269ab5f7e29926cb18" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_bd55b203eb9f92b0c8390380010" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_c7481daf5059307842edef74d73" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_e156b298c20873e14c362e789bf" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_71d739ec6ca8fbcb3adde0bbe3d" FOREIGN KEY ("source_file_id") REFERENCES "user_files"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_items" ADD CONSTRAINT "FK_32a09bcb80f407e783bbad62214" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_items" ADD CONSTRAINT "FK_714e902e9185a3f368914902ed2" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge_items" ADD CONSTRAINT "FK_85116821114f7c410ac4e2b943d" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_5588b6cea298cedec7063c0d33e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_5588b6cea298cedec7063c0d33e"`);
        await queryRunner.query(`ALTER TABLE "knowledge_items" DROP CONSTRAINT "FK_85116821114f7c410ac4e2b943d"`);
        await queryRunner.query(`ALTER TABLE "knowledge_items" DROP CONSTRAINT "FK_714e902e9185a3f368914902ed2"`);
        await queryRunner.query(`ALTER TABLE "knowledge_items" DROP CONSTRAINT "FK_32a09bcb80f407e783bbad62214"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_71d739ec6ca8fbcb3adde0bbe3d"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_e156b298c20873e14c362e789bf"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_c7481daf5059307842edef74d73"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_bd55b203eb9f92b0c8390380010"`);
        await queryRunner.query(`ALTER TABLE "user_files" DROP CONSTRAINT "FK_8d2cd7418269ab5f7e29926cb18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5588b6cea298cedec7063c0d33"`);
        await queryRunner.query(`DROP TABLE "chat_messages"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_85116821114f7c410ac4e2b943"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_714e902e9185a3f368914902ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32a09bcb80f407e783bbad6221"`);
        await queryRunner.query(`DROP TABLE "knowledge_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e156b298c20873e14c362e789b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c7481daf5059307842edef74d7"`);
        await queryRunner.query(`DROP TABLE "documents"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd55b203eb9f92b0c839038001"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d2cd7418269ab5f7e29926cb1"`);
        await queryRunner.query(`DROP TABLE "user_files"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
