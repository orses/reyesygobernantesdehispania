// ---------------------------------------------------------------------------
// Tests unitarios: lib/succession.ts
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { derivePeopleFromRows } from "./people";
import {
    buildGovernmentSuccession,
    buildSuccessionOptions,
    resolveSuccessionSelectValue,
    successionRowRef,
} from "./succession";
import type { RawRow } from "./types";

function multiKingdomRows(): RawRow[] {
    return [
        {
            _rowId: "aragon-martin",
            PersonID: "martin",
            Nombre: "Martin I",
            Reino: "Corona de Aragon",
            "Inicio del reinado (año)": 1396,
            "Final del reinado (año)": 1410,
        },
        {
            _rowId: "aragon-fernando",
            PersonID: "fernando",
            Nombre: "Fernando I",
            Reino: "Corona de Aragon",
            "Inicio del reinado (año)": 1412,
            "Final del reinado (año)": 1416,
        },
        {
            _rowId: "aragon-alfonso",
            PersonID: "alfonso-aragon",
            Nombre: "Alfonso V",
            Reino: "Corona de Aragon",
            "Inicio del reinado (año)": 1416,
            "Final del reinado (año)": 1458,
        },
        {
            _rowId: "castilla-sancho",
            PersonID: "sancho-castilla",
            Nombre: "Sancho III",
            Reino: "Reino de Castilla",
            "Inicio del reinado (año)": 1029,
            "Final del reinado (año)": 1035,
        },
        {
            _rowId: "castilla-fernando",
            PersonID: "fernando",
            Nombre: "Fernando I",
            Reino: "Reino de Castilla",
            "Inicio del reinado (año)": 1035,
            "Final del reinado (año)": 1065,
        },
        {
            _rowId: "castilla-sancho-ii",
            PersonID: "sancho-ii",
            Nombre: "Sancho II",
            Reino: "Reino de Castilla",
            "Inicio del reinado (año)": 1065,
            "Final del reinado (año)": 1072,
        },
    ];
}

describe("buildGovernmentSuccession", () => {
    it("calcula predecesor y sucesor por reino aunque el PersonID sea el mismo", () => {
        const { allPeople } = derivePeopleFromRows(multiKingdomRows());
        const succession = buildGovernmentSuccession(allPeople);

        expect(succession.get("aragon-fernando")).toMatchObject({
            predecessor: { personId: "martin", nombreReinado: "Martin I" },
            successor: { personId: "alfonso-aragon", nombreReinado: "Alfonso V" },
            predecessorSource: "chronological",
            successorSource: "chronological",
        });
        expect(succession.get("castilla-fernando")).toMatchObject({
            predecessor: { personId: "sancho-castilla", nombreReinado: "Sancho III" },
            successor: { personId: "sancho-ii", nombreReinado: "Sancho II" },
            predecessorSource: "chronological",
            successorSource: "chronological",
        });
    });

    it("muestra nombres de sucesión sin apelativos para compactar los botones", () => {
        const rows: RawRow[] = [
            {
                _rowId: "castilla-enrique",
                PersonID: "enrique",
                Nombre: "Enrique IV",
                Apelativo: "el Impotente",
                Reino: "Corona de Castilla",
                "Inicio del reinado (año)": 1454,
                "Final del reinado (año)": 1474,
            },
            {
                _rowId: "castilla-isabel",
                PersonID: "isabel",
                Nombre: "Isabel I",
                Reino: "Corona de Castilla",
                "Inicio del reinado (año)": 1474,
                "Final del reinado (año)": 1504,
            },
            {
                _rowId: "castilla-fernando",
                PersonID: "fernando",
                Nombre: "Fernando V",
                Apelativo: "el Católico",
                Reino: "Corona de Castilla",
                "Inicio del reinado (año)": 1479,
                "Final del reinado (año)": 1516,
            },
        ];

        const { allPeople } = derivePeopleFromRows(rows);
        const succession = buildGovernmentSuccession(allPeople);

        expect(succession.get("castilla-isabel")).toMatchObject({
            predecessor: { nombreReinado: "Enrique IV" },
            successor: { nombreReinado: "Fernando V" },
        });
    });

    it("aplica los overrides manuales solo al gobierno que los declara", () => {
        const rows: RawRow[] = [
            ...multiKingdomRows(),
            {
                _rowId: "aragon-jaime",
                PersonID: "jaime",
                Nombre: "Jaime de prueba",
                Reino: "Corona de Aragon",
                "Inicio del reinado (año)": 1200,
                "Final del reinado (año)": 1210,
            },
        ].map((row) =>
            row._rowId === "aragon-fernando"
                ? { ...row, Predecesor: "jaime", Sucesor: "sancho-ii" }
                : row
        );

        const { allPeople } = derivePeopleFromRows(rows);
        const succession = buildGovernmentSuccession(allPeople);

        expect(succession.get("aragon-fernando")).toMatchObject({
            predecessor: { personId: "jaime", nombreReinado: "Jaime de prueba" },
            successor: { personId: "sancho-ii", nombreReinado: "Sancho II" },
            predecessorSource: "manual",
            successorSource: "manual",
        });
        expect(succession.get("castilla-fernando")).toMatchObject({
            predecessor: { personId: "sancho-castilla" },
            successor: { personId: "sancho-ii" },
            predecessorSource: "chronological",
            successorSource: "chronological",
        });
    });

    it("permite elegir una denominación concreta de una persona con varios gobiernos", () => {
        const rows: RawRow[] = [
            {
                _rowId: "castilla-fernando",
                PersonID: "fernando",
                "Nombre principal": "Fernando V",
                Nombre: "Fernando V",
                Reino: "Corona de Castilla",
                "Inicio del reinado (año)": 1479,
                "Final del reinado (año)": 1516,
            },
            {
                _rowId: "aragon-fernando",
                PersonID: "fernando",
                "Nombre principal": "Fernando V",
                Nombre: "Fernando II",
                Reino: "Corona de Aragón",
                "Inicio del reinado (año)": 1479,
                "Final del reinado (año)": 1516,
            },
            {
                _rowId: "castilla-juana",
                PersonID: "juana",
                Nombre: "Juana I",
                Reino: "Corona de Castilla",
                "Inicio del reinado (año)": 1504,
                "Final del reinado (año)": 1555,
            },
            {
                _rowId: "aragon-juana",
                PersonID: "juana",
                Nombre: "Juana I",
                Reino: "Corona de Aragón",
                "Inicio del reinado (año)": 1516,
                "Final del reinado (año)": 1555,
                Predecesor: successionRowRef("aragon-fernando"),
            },
        ];

        const { allPeople } = derivePeopleFromRows(rows);
        const options = buildSuccessionOptions(allPeople, "aragon-juana");
        const succession = buildGovernmentSuccession(allPeople);

        expect(options).toEqual(expect.arrayContaining([
            expect.objectContaining({
                value: successionRowRef("castilla-fernando"),
                personId: "fernando",
                nombreReinado: "Fernando V",
                reino: "Corona de Castilla",
            }),
            expect.objectContaining({
                value: successionRowRef("aragon-fernando"),
                personId: "fernando",
                nombreReinado: "Fernando II",
                reino: "Corona de Aragón",
            }),
        ]));
        expect(options.some((option) => option.rowId === "aragon-juana")).toBe(false);
        expect(resolveSuccessionSelectValue("fernando", options, "Corona de Aragón")).toBe(
            successionRowRef("aragon-fernando")
        );
        expect(succession.get("aragon-juana")).toMatchObject({
            predecessor: {
                personId: "fernando",
                nombrePrincipal: "Fernando V",
                nombreReinado: "Fernando II",
            },
            predecessorSource: "manual",
        });
    });

    it("mantiene periodos discontinuos del mismo personaje sin fusionarlos", () => {
        const rows: RawRow[] = [
            {
                _rowId: "leon-alfonso-1",
                PersonID: "alfonso",
                Nombre: "Alfonso",
                Reino: "Reino de Leon",
                "Inicio del reinado (año)": 1000,
                "Final del reinado (año)": 1005,
            },
            {
                _rowId: "leon-bermudo",
                PersonID: "bermudo",
                Nombre: "Bermudo",
                Reino: "Reino de Leon",
                "Inicio del reinado (año)": 1005,
                "Final del reinado (año)": 1010,
            },
            {
                _rowId: "leon-alfonso-2",
                PersonID: "alfonso",
                Nombre: "Alfonso",
                Reino: "Reino de Leon",
                "Inicio del reinado (año)": 1012,
                "Final del reinado (año)": 1028,
            },
        ];

        const { allPeople } = derivePeopleFromRows(rows);
        const succession = buildGovernmentSuccession(allPeople);

        expect(succession.get("leon-alfonso-1")).toMatchObject({
            predecessor: null,
            successor: { personId: "bermudo" },
        });
        expect(succession.get("leon-alfonso-2")).toMatchObject({
            predecessor: { personId: "bermudo" },
            successor: null,
        });
    });

    it("resuelve sucesión manual aunque no haya reino para cálculo automático", () => {
        const rows: RawRow[] = [
            {
                _rowId: "sin-reino",
                PersonID: "titular",
                Nombre: "Titular sin reino",
                Reino: "",
                Predecesor: "manual-pre",
                Sucesor: "manual-suc",
            },
            {
                _rowId: "manual-pre",
                PersonID: "manual-pre",
                Nombre: "Predecesor manual",
                Reino: "Reino auxiliar",
            },
            {
                _rowId: "manual-suc",
                PersonID: "manual-suc",
                Nombre: "Sucesor manual",
                Reino: "Reino auxiliar",
            },
        ];

        const { allPeople } = derivePeopleFromRows(rows);
        const succession = buildGovernmentSuccession(allPeople);

        expect(succession.get("sin-reino")).toMatchObject({
            predecessor: { personId: "manual-pre", nombreReinado: "Predecesor manual" },
            successor: { personId: "manual-suc", nombreReinado: "Sucesor manual" },
            predecessorSource: "manual",
            successorSource: "manual",
        });
    });
});
