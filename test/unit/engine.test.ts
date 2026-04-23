import { describe, it, expect } from "vitest";
import { resolve, encodeCellRef, decodeCellRef } from "@/lib/jedox/engine";
import type { CellRef } from "@/lib/jedox/schema";

describe("engine.resolve — leaf accounts", () => {
  it("returns a finite number for a leaf cell at a real period", () => {
    const r = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "Revenue_Product",
      period: "2026-03",
      version: "Actual",
      currency: "EUR",
    });
    expect(r).not.toBeNull();
    expect(Number.isFinite(r!.value)).toBe(true);
    expect(r!.derived).toBe(false);
    expect(r!.provenance.length).toBeGreaterThanOrEqual(1);
  });

  it("returns null for a bogus entity id", () => {
    const r = resolve({
      entity: "ENT_NOT_A_THING",
      account: "Revenue_Product",
      period: "2026-03",
      version: "Actual",
      currency: "EUR",
    });
    expect(r).toBeNull();
  });

  it("returns null for a bogus account id", () => {
    const r = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "NotARealAccount",
      period: "2026-03",
      version: "Actual",
      currency: "EUR",
    });
    expect(r).toBeNull();
  });
});

describe("engine.resolve — derived accounts", () => {
  it("Revenue sums product + services and reports a rule", () => {
    const r = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "Revenue",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    });
    expect(r).not.toBeNull();
    expect(r!.derived).toBe(true);
    expect(r!.rule).toMatch(/Revenue_Product/);
    expect(r!.rule).toMatch(/Revenue_Services/);

    const p = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "Revenue_Product",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    const s = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "Revenue_Services",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    expect(Math.abs(r!.value - (p + s))).toBeLessThan(1);
  });

  it("EBITDA matches GrossProfit − OpEx", () => {
    const gp = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "GrossProfit",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    const opex = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "OpEx",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    const ebitda = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "EBITDA",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    expect(Math.abs(ebitda - (gp - opex))).toBeLessThan(Math.max(Math.abs(ebitda) * 0.01, 1));
  });

  it("EBITDAMarginPct is EBITDA / Revenue (0 ≤ |pct| ≤ 1)", () => {
    const r = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "EBITDAMarginPct",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    });
    expect(r).not.toBeNull();
    expect(Math.abs(r!.value)).toBeLessThan(1);
  });
});

describe("engine.resolve — synthetic valuation accounts", () => {
  it("FairValue at V1 and V2 both resolve with real rule text", () => {
    for (const [period, version] of [
      ["2025-12", "Valuation-V1"],
      ["2026-03", "Valuation-V2"],
    ] as const) {
      const r = resolve({
        entity: "ENT_ATLAS_NL",
        account: "FairValue",
        period,
        version,
        currency: "EUR",
      });
      expect(r, `${period}/${version}`).not.toBeNull();
      expect(Number.isFinite(r!.value)).toBe(true);
      expect(r!.derived).toBe(true);
      expect(r!.rule).toMatch(/EBITDA|Multiple|NetDebt/);
    }
  });

  it("each Bridge:* leg resolves at V2", () => {
    const legs = [
      "Bridge:ebitdaEffect",
      "Bridge:multipleEffect",
      "Bridge:leverageEffect",
      "Bridge:fxEffect",
      "Bridge:crossTerm",
      "Bridge:otherEffect",
      "Bridge:total",
    ];
    for (const leg of legs) {
      const r = resolve({
        entity: "ENT_ATLAS_NL",
        account: leg,
        period: "2026-03",
        version: "Valuation-V2",
        currency: "EUR",
      });
      expect(r, leg).not.toBeNull();
      expect(Number.isFinite(r!.value)).toBe(true);
    }
  });

  it("Bridge:total ≈ V2.fv − V1.fv (identity)", () => {
    const v1 = resolve({
      entity: "ENT_ATLAS_NL",
      account: "FairValue",
      period: "2025-12",
      version: "Valuation-V1",
      currency: "EUR",
    })!.value;
    const v2 = resolve({
      entity: "ENT_ATLAS_NL",
      account: "FairValue",
      period: "2026-03",
      version: "Valuation-V2",
      currency: "EUR",
    })!.value;
    const total = resolve({
      entity: "ENT_ATLAS_NL",
      account: "Bridge:total",
      period: "2026-03",
      version: "Valuation-V2",
      currency: "EUR",
    })!.value;
    expect(Math.abs(total - (v2 - v1))).toBeLessThan(Math.max(Math.abs(v2 - v1) * 0.01, 1));
  });
});

describe("engine.resolve — entity aggregation", () => {
  it("PORTFOLIO_TOTAL Revenue = sum of group Revenues within rounding", () => {
    const totalRev = resolve({
      entity: "PORTFOLIO_TOTAL",
      account: "Revenue",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    const groups = ["CG_BUYOUTS", "CG_GROWTH", "CG_SPECSIT"].map(
      (g) =>
        resolve({
          entity: g,
          account: "Revenue",
          period: "YTD-2026-03",
          version: "Actual",
          currency: "EUR",
        })?.value ?? 0
    );
    const sum = groups.reduce((a, b) => a + b, 0);
    expect(Math.abs(totalRev - sum)).toBeLessThan(Math.max(Math.abs(totalRev) * 0.01, 10));
  });
});

describe("engine.resolve — period aggregation", () => {
  it("YTD-2026-03 Revenue equals sum of 2026-01 + 2026-02 + 2026-03", () => {
    const ytd = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "Revenue",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    const months = ["2026-01", "2026-02", "2026-03"].map(
      (p) =>
        resolve({
          entity: "ENT_FORTUNA_DE",
          account: "Revenue",
          period: p,
          version: "Actual",
          currency: "EUR",
        })!.value
    );
    const sum = months.reduce((a, b) => a + b, 0);
    expect(Math.abs(ytd - sum)).toBeLessThan(Math.max(Math.abs(ytd) * 0.01, 1));
  });
});

describe("encodeCellRef / decodeCellRef — round trip", () => {
  it("survives base64url round-trip", () => {
    const ref: CellRef = {
      cube: "FIN_CUBE",
      entity: "ENT_FORTUNA_DE",
      account: "Revenue",
      time: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
      measure: "Value",
    };
    const encoded = encodeCellRef(ref);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = decodeCellRef(encoded);
    expect(back).toEqual(ref);
  });
});
