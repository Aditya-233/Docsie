import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getBasePath, getAuthRedirectUrl } from "../lib/supabase/base-path";

describe("Base Path & Auth Redirection Utility", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    process.env.NEXT_PUBLIC_BASE_PATH = originalEnv;
  });

  it("should return empty string when NEXT_PUBLIC_BASE_PATH is not set and window is undefined", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    assert.strictEqual(getBasePath(), "");
  });

  it("should return configured NEXT_PUBLIC_BASE_PATH with leading slash", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/Docsie";
    assert.strictEqual(getBasePath(), "/Docsie");

    process.env.NEXT_PUBLIC_BASE_PATH = "Docsie";
    assert.strictEqual(getBasePath(), "/Docsie");

    process.env.NEXT_PUBLIC_BASE_PATH = "/Docsie/";
    assert.strictEqual(getBasePath(), "/Docsie");
  });

  it("should construct getAuthRedirectUrl accurately", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/Docsie";
    const url = getAuthRedirectUrl("/doc/test-doc");
    assert.strictEqual(url, "/Docsie/auth/callback?next=%2Fdoc%2Ftest-doc");
  });

  it("should default to root '/' destination if nextPath not provided", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "";
    const url = getAuthRedirectUrl();
    assert.strictEqual(url, "/auth/callback?next=%2F");
  });
});
