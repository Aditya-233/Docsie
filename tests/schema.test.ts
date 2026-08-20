import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Supabase PostgreSQL Database Schema & Security Policies", () => {
  const schemaPath = path.resolve(process.cwd(), "supabase/migrations/20260820000000_initial_schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  it("should define yjs_documents table with room PRIMARY KEY and state BYTEA", () => {
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.yjs_documents"));
    assert.ok(sql.includes("room TEXT PRIMARY KEY"));
    assert.ok(sql.includes("state BYTEA NOT NULL"));
  });

  it("should define documents table with owner_id foreign key reference to auth.users", () => {
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.documents"));
    assert.ok(sql.includes("owner_id UUID REFERENCES auth.users(id)"));
    assert.ok(sql.includes("page_format TEXT NOT NULL DEFAULT 'letter'"));
  });

  it("should define document_collaborators table with composite primary key and role constraint", () => {
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.document_collaborators"));
    assert.ok(sql.includes("PRIMARY KEY (document_id, user_id)"));
    assert.ok(sql.includes("CHECK (role IN ('editor', 'viewer', 'commenter'))"));
  });

  it("should define comments and document_versions tables", () => {
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.comments"));
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.document_versions"));
  });

  it("should enable Row Level Security (RLS) on all user data tables", () => {
    assert.ok(sql.includes("ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;"));
    assert.ok(sql.includes("ALTER TABLE public.document_collaborators ENABLE ROW LEVEL SECURITY;"));
    assert.ok(sql.includes("ALTER TABLE public.yjs_documents ENABLE ROW LEVEL SECURITY;"));
    assert.ok(sql.includes("ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;"));
    assert.ok(sql.includes("ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;"));
  });

  it("should configure document_images storage bucket with public access and upload policies", () => {
    assert.ok(sql.includes("INSERT INTO storage.buckets"));
    assert.ok(sql.includes("'document_images'"));
    assert.ok(sql.includes("CREATE POLICY \"Public read access for document images\""));
  });
});
