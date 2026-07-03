import { describe, expect, it } from "vitest";
import { uint8ArrayToArrayBuffer } from "./blob";

describe("uint8ArrayToArrayBuffer", () => {
  it("copia todos los bytes a un ArrayBuffer independiente", () => {
    const source = new Uint8Array([1, 2, 3]);
    const buffer = uint8ArrayToArrayBuffer(source);
    const copy = new Uint8Array(buffer);

    expect(copy).toEqual(source);

    source[0] = 9;
    expect(copy[0]).toBe(1);
  });

  it("respeta vistas parciales sobre un buffer mayor", () => {
    const source = new Uint8Array([10, 20, 30, 40]).subarray(1, 3);
    const buffer = uint8ArrayToArrayBuffer(source);

    expect(Array.from(new Uint8Array(buffer))).toEqual([20, 30]);
  });
});
