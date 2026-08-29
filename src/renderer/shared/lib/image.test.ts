import { describe, it, expect } from "vitest";
import { productImageSrc } from "./image";

describe("productImageSrc", () => {
  it("returns undefined for null, undefined and empty string", () => {
    expect(productImageSrc(null)).toBeUndefined();
    expect(productImageSrc(undefined)).toBeUndefined();
    expect(productImageSrc("")).toBeUndefined();
  });

  it("passes legacy data URLs through untouched", () => {
    const dataUrl = "data:image/webp;base64,UklGRgA=";
    expect(productImageSrc(dataUrl)).toBe(dataUrl);
  });

  it("maps a managed file name to a venilu:// URL", () => {
    expect(productImageSrc("abc123.webp")).toBe("venilu://product-images/abc123.webp");
  });

  it("URL-encodes special characters in the file name", () => {
    expect(productImageSrc("café con espacio.webp")).toBe(
      `venilu://product-images/${encodeURIComponent("café con espacio.webp")}`
    );
    // Path traversal attempts stay inside the encoded segment
    expect(productImageSrc("../secret")).toBe("venilu://product-images/..%2Fsecret");
  });
});
