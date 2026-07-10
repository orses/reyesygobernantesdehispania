import { describe, expect, it } from "vitest";
import { filterComboboxOptions, type ComboboxOption } from "./combobox";

const options: ComboboxOption[] = [
  {
    value: "row:leon-1066",
    label: "Reino de León · Alfonso VI · 1066",
    keywords: ["alfonso", "leon", "1066"],
  },
  {
    value: "row:aragon-1104",
    label: "Corona de Aragón · Alfonso I · 1104",
    keywords: ["aragon", "1104"],
  },
  {
    value: "row:asturias-737",
    label: "Reino de Asturias · Pelayo · 718",
    keywords: ["astur-leonesa", "737"],
  },
];

describe("filterComboboxOptions", () => {
  it("filtra por texto normalizado sin depender de tildes ni mayúsculas", () => {
    expect(filterComboboxOptions(options, "leon 1066")).toEqual([options[0]]);
    expect(filterComboboxOptions(options, "ARAGON")).toEqual([options[1]]);
  });

  it("busca también en palabras clave", () => {
    expect(filterComboboxOptions(options, "737")).toEqual([options[2]]);
    expect(filterComboboxOptions(options, "astur leonesa")).toEqual([options[2]]);
  });
});
