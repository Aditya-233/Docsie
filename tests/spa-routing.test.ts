import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractSpaRedirectTarget,
  buildSpaRedirectUrl,
  resolveHistoryPath,
} from "../lib/spa-routing";

describe("GitHub Pages SPA Routing & 404 Fallback", () => {
  describe("SPA Redirect Target Extraction & Sanitization", () => {
    it("should extract valid relative routes", () => {
      assert.strictEqual(extractSpaRedirectTarget("/doc/demo"), "/doc/demo");
      assert.strictEqual(extractSpaRedirectTarget("/doc/abc-123-uuid"), "/doc/abc-123-uuid");
      assert.strictEqual(extractSpaRedirectTarget("/auth/callback"), "/auth/callback");
      assert.strictEqual(extractSpaRedirectTarget("/login"), "/login");
    });

    it("should extract routes with query parameters and hash fragments", () => {
      assert.strictEqual(
        extractSpaRedirectTarget("/doc/123?tab=comments&v=2"),
        "/doc/123?tab=comments&v=2"
      );
      assert.strictEqual(
        extractSpaRedirectTarget("/auth/callback?code=abc&state=xyz#token=123"),
        "/auth/callback?code=abc&state=xyz#token=123"
      );
    });

    it("should handle URI-encoded target strings", () => {
      const encoded = encodeURIComponent("/doc/abc-123?q=search%20term#heading-1");
      assert.strictEqual(
        extractSpaRedirectTarget(encoded),
        "/doc/abc-123?q=search%20term#heading-1"
      );
    });

    it("should reject null, undefined, or empty parameters", () => {
      assert.strictEqual(extractSpaRedirectTarget(null), null);
      assert.strictEqual(extractSpaRedirectTarget(undefined), null);
      assert.strictEqual(extractSpaRedirectTarget(""), null);
    });

    it("should prevent open redirect vulnerabilities and protocol-relative paths", () => {
      // Protocol-relative URLs
      assert.strictEqual(extractSpaRedirectTarget("//attacker.com"), null);
      assert.strictEqual(extractSpaRedirectTarget("//attacker.com/evil"), null);

      // External absolute URLs
      assert.strictEqual(extractSpaRedirectTarget("https://attacker.com"), null);
      assert.strictEqual(extractSpaRedirectTarget("http://attacker.com"), null);
      assert.strictEqual(extractSpaRedirectTarget("javascript:alert(1)"), null);

      // Malicious backslash paths
      assert.strictEqual(extractSpaRedirectTarget("/\\attacker.com"), null);
      assert.strictEqual(extractSpaRedirectTarget("/doc/evil\\test"), null);
    });
  });

  describe("404 Redirect URL Generation (buildSpaRedirectUrl)", () => {
    it("should construct redirect URL for repository base path (/Docsie)", () => {
      const url = buildSpaRedirectUrl("/Docsie/doc/uuid-456", "", "", "/Docsie");
      assert.strictEqual(url, "/Docsie/?p=%2Fdoc%2Fuuid-456");
    });

    it("should preserve query string and hash when constructing redirect URL", () => {
      const url = buildSpaRedirectUrl(
        "/Docsie/auth/callback",
        "?code=12345&next=/doc/new",
        "#access_token=xyz",
        "/Docsie"
      );
      assert.strictEqual(
        url,
        "/Docsie/?p=%2Fauth%2Fcallback%3Fcode%3D12345%26next%3D%2Fdoc%2Fnew%23access_token%3Dxyz"
      );
    });

    it("should handle root-hosted paths (no repo prefix)", () => {
      const url = buildSpaRedirectUrl("/doc/custom-id", "?theme=dark", "", "/Docsie");
      assert.strictEqual(url, "/?p=%2Fdoc%2Fcustom-id%3Ftheme%3Ddark");
    });
  });

  describe("History Path Resolution (resolveHistoryPath)", () => {
    it("should prepend repository prefix when in GitHub Pages repo environment", () => {
      const resolved = resolveHistoryPath("/doc/abc-123", "/Docsie/", "/Docsie");
      assert.strictEqual(resolved, "/Docsie/doc/abc-123");
    });

    it("should not prepend repository prefix when running at root", () => {
      const resolved = resolveHistoryPath("/doc/abc-123", "/", "/Docsie");
      assert.strictEqual(resolved, "/doc/abc-123");
    });
  });
});
