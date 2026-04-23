"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, GitBranch, Binary, Layers, Search, ArrowRight, Table as TableIcon } from "lucide-react";
import { CubeCell } from "@/components/cube-cell";
import { formatCellValueCompact } from "@/lib/format";
import { Input } from "@/components/ui/input";

interface SchemaResponse {
  cubes: Array<{ id: string; label: string; dims: string[]; description: string }>;
  dimensions: Record<string, { count: number; hierarchies?: string[]; values?: string[] }>;
  accounts: {
    leaves: Array<{ id: string; group: string }>;
    derived: Array<{ id: string; group: string; rule: string }>;
  };
  rules: Array<{ target: string; expr: string; group: string }>;
}

const CUBE_BLURB: Record<string, string> = {
  FIN_CUBE:
    "The primary financial cube. Every P&L, Balance Sheet and Cash Flow figure — across Actual, Budget, Forecast (Management + PIL) and Valuation versions — flows through here. This is what the agent queries when answering variance questions.",
  VAL_CUBE:
    "Fair-value snapshots per entity per valuation method (Multiples, DCF, NAV). The V1→V2 bridge is reconstructed from this cube combined with LTM EBITDA and Net Debt from FIN_CUBE.",
  META_CUBE:
    "Non-financial context: headcount, ownership %, acquisition dates, and normalization adjustments used for like-for-like comparisons.",
};

const GROUP_LABEL: Record<string, string> = {
  PL: "Profit & Loss",
  BS: "Balance Sheet",
  CF: "Cash Flow",
  KPI: "KPIs",
};

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span className="text-foreground">{text}</span>;
  const re = new RegExp(
    `(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "ig"
  );
  const parts = text.split(re);
  return (
    <span className="text-foreground">
      {parts.map((p, i) =>
        re.test(p) ? (
          <mark key={i} className="bg-accent-blue/20 text-foreground rounded px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

// Parse which account ids a rule expression depends on. Rules look like
// "[Revenue_Product] + [Revenue_Services]" or "[EBITDA] / [Revenue]".
function extractDeps(expr: string): string[] {
  const deps = new Set<string>();
  const re = /\[([A-Za-z0-9_]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) deps.add(m[1]);
  return [...deps];
}

export function DataModelExplorer() {
  const { data, isLoading } = useQuery({
    queryKey: ["schema"],
    queryFn: async () => {
      const r = await fetch("/api/schema");
      return (await r.json()) as SchemaResponse;
    },
    staleTime: 5 * 60_000,
  });

  // Global search — filters all tabs.
  const [globalQuery, setGlobalQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("cubes");
  // When a user clicks "show rules referencing X", we scope the rules tab to
  // that account id via `pinnedDep`.
  const [pinnedDep, setPinnedDep] = useState<string | null>(null);

  // Account ↔ rule dependency index.
  const { accountDeps, rulesByDep } = useMemo(() => {
    const rulesByDep = new Map<string, Set<string>>();
    const accountDeps = new Map<string, string[]>();
    if (!data) return { accountDeps, rulesByDep };
    for (const r of data.rules) {
      const deps = extractDeps(r.expr);
      accountDeps.set(r.target, deps);
      for (const d of deps) {
        if (!rulesByDep.has(d)) rulesByDep.set(d, new Set());
        rulesByDep.get(d)!.add(r.target);
      }
    }
    return { accountDeps, rulesByDep };
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="p-6 max-w-[1440px] mx-auto">
        <Skeleton className="h-10 w-80 mb-4" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  const q = globalQuery.trim().toLowerCase();
  const matchesQuery = (s: string) => !q || s.toLowerCase().includes(q);

  const filteredCubes = data.cubes.filter(
    (c) =>
      matchesQuery(c.id) ||
      matchesQuery(c.label) ||
      matchesQuery(c.description) ||
      c.dims.some((d) => matchesQuery(d))
  );
  const filteredDims = Object.entries(data.dimensions).filter(
    ([name, dim]) =>
      matchesQuery(name) ||
      (dim.values ?? []).some((v) => matchesQuery(v)) ||
      (dim.hierarchies ?? []).some((h) => matchesQuery(h))
  );
  const filteredRules = data.rules.filter((r) => {
    if (pinnedDep) {
      const deps = accountDeps.get(r.target) ?? [];
      return deps.includes(pinnedDep);
    }
    if (!q) return true;
    return (
      matchesQuery(r.target) ||
      matchesQuery(r.expr) ||
      matchesQuery(r.group)
    );
  });

  const jumpToAccount = (accountId: string) => {
    setPinnedDep(null);
    setGlobalQuery(accountId);
    setActiveTab("accounts");
  };

  const filterRulesByDep = (accountId: string) => {
    setPinnedDep(accountId);
    setActiveTab("rules");
  };

  const viewCubeDimensions = (cube: { id: string; dims: string[] }) => {
    setPinnedDep(null);
    setGlobalQuery(cube.dims[0] ?? "");
    setActiveTab("dimensions");
  };

  const totalHits =
    filteredCubes.length +
    filteredDims.length +
    filteredRules.length +
    data.accounts.leaves.filter((l) => matchesQuery(l.id) || matchesQuery(l.group)).length +
    data.accounts.derived.filter((d) => matchesQuery(d.id) || matchesQuery(d.rule) || matchesQuery(d.group)).length;

  return (
    <div className="p-6 pb-10 max-w-[1440px] mx-auto space-y-4">
      <div>
        <div className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5 font-medium">
          <Database className="h-3.5 w-3.5" /> Data Model Explorer
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight mt-1.5">
          UNITY · Jedox cube schema
        </h1>
      </div>

      <Card className="p-5 bg-muted/30 border-border/80">
        <div className="grid md:grid-cols-[auto_1fr] gap-4 items-start">
          <div className="h-10 w-10 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
            <Database className="h-5 w-5 text-accent-blue" />
          </div>
          <div className="text-[14px] leading-relaxed text-foreground/85 space-y-2">
            <p>
              <strong className="text-foreground">
                UNITY is the agent&rsquo;s view of your Jedox reporting.
              </strong>{" "}
              It doesn&rsquo;t hold new data — it reads the same cubes, dimensions, and derivation
              rules your finance team already maintains. Every number the agent cites anywhere in
              the product resolves back to a cell in this model.
            </p>
            <p className="text-muted-foreground">
              Click a cube to see its dimensions; click a derived account to see where it&rsquo;s
              referenced; hover a dependency token in a rule to filter rules that use that
              account.
            </p>
          </div>
        </div>
      </Card>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={globalQuery}
          onChange={(e) => {
            setGlobalQuery(e.target.value);
            setPinnedDep(null);
          }}
          placeholder="Search across cubes, dimensions, rules, accounts…"
          className="h-10 pl-8 text-[14px]"
        />
        {q && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums">
            {totalHits} hit{totalHits === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {pinnedDep && (
        <div className="flex items-center gap-2 text-[12.5px] bg-accent-blue-soft px-3 py-1.5 rounded-md">
          <span>Filtering rules referencing</span>
          <span className="font-mono font-semibold">{pinnedDep}</span>
          <button
            onClick={() => setPinnedDep(null)}
            className="ml-auto text-[11.5px] text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-10 bg-muted/30 border-b border-border w-full rounded-none justify-start px-3">
            <TabsTrigger value="cubes">
              Cubes <span className="ml-1 text-muted-foreground">{filteredCubes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="dimensions">
              Dimensions <span className="ml-1 text-muted-foreground">{filteredDims.length}</span>
            </TabsTrigger>
            <TabsTrigger value="rules">
              Rules <span className="ml-1 text-muted-foreground">{filteredRules.length}</span>
            </TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="sample" className="gap-1">
              <TableIcon className="h-3 w-3" />
              Sample Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cubes" className="m-0 p-5 space-y-3">
            {filteredCubes.map((c) => (
              <Card key={c.id} className="p-5 shadow-none">
                <div className="flex items-center gap-2 flex-wrap">
                  <Layers className="h-4 w-4 text-accent-blue" />
                  <span className="font-mono text-[14px] font-semibold">
                    <HighlightText text={c.id} query={q} />
                  </span>
                  <span className="text-[13px] text-muted-foreground">· {c.label}</span>
                  <button
                    onClick={() => viewCubeDimensions(c)}
                    className="ml-auto inline-flex items-center gap-1 text-[12px] text-accent-blue hover:underline underline-offset-2"
                  >
                    View dimensions <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-[13.5px] text-foreground/85 mt-1.5 leading-relaxed">
                  <HighlightText text={CUBE_BLURB[c.id] ?? c.description} query={q} />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {c.dims.map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setPinnedDep(null);
                        setGlobalQuery(d);
                        setActiveTab("dimensions");
                      }}
                      className="rounded bg-muted px-2 py-0.5 text-[11.5px] font-mono text-muted-foreground hover:bg-accent-blue/20 hover:text-accent-blue transition"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
            {filteredCubes.length === 0 && (
              <div className="text-[13px] text-muted-foreground italic px-1 py-6 text-center">
                No cubes match that search.
              </div>
            )}
          </TabsContent>

          <TabsContent value="dimensions" className="m-0 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredDims.map(([name, dim]) => (
                <Card key={name} className="p-4 shadow-none">
                  <div className="flex items-center gap-2">
                    <Binary className="h-4 w-4 text-accent-blue" />
                    <span className="font-mono text-[14px] font-semibold">
                      <HighlightText text={name} query={q} />
                    </span>
                    <span className="ml-auto text-[12px] text-muted-foreground tabular-nums">
                      {dim.count} {dim.count === 1 ? "element" : "elements"}
                    </span>
                  </div>
                  {dim.hierarchies && dim.hierarchies.length > 0 && (
                    <div className="mt-2 text-[12.5px] text-muted-foreground">
                      {dim.hierarchies.length === 1
                        ? `Hierarchy: ${dim.hierarchies[0]}`
                        : `Hierarchies: ${dim.hierarchies.join(", ")}`}
                    </div>
                  )}
                  {dim.values && dim.values.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dim.values.slice(0, 8).map((v) => (
                        <span
                          key={v}
                          className="rounded bg-muted px-2 py-0.5 text-[11.5px] font-mono"
                        >
                          <HighlightText text={v} query={q} />
                        </span>
                      ))}
                      {dim.values.length > 8 && (
                        <span className="text-[11.5px] text-muted-foreground">
                          +{dim.values.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
            {filteredDims.length === 0 && (
              <div className="text-[13px] text-muted-foreground italic px-1 py-6 text-center">
                No dimensions match that search.
              </div>
            )}
          </TabsContent>

          <TabsContent value="rules" className="m-0 p-5 space-y-2">
            {filteredRules.map((r) => {
              const deps = accountDeps.get(r.target) ?? [];
              const referencedBy = rulesByDep.get(r.target);
              return (
                <div
                  key={r.target}
                  className="rounded-md border border-border/70 bg-background px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <GitBranch className="h-3.5 w-3.5 text-accent-blue" />
                    <button
                      onClick={() => jumpToAccount(r.target)}
                      className="font-mono text-[13.5px] font-semibold hover:text-accent-blue transition"
                    >
                      <HighlightText text={r.target} query={q} />
                    </button>
                    {referencedBy && referencedBy.size > 0 && (
                      <button
                        onClick={() => filterRulesByDep(r.target)}
                        className="text-[10.5px] text-muted-foreground hover:text-accent-blue"
                        title="Filter rules that reference this account"
                      >
                        used by {referencedBy.size} rule{referencedBy.size === 1 ? "" : "s"}
                      </button>
                    )}
                    <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                      {r.group}
                    </span>
                  </div>
                  <div className="font-mono text-[13px] text-muted-foreground mt-1 ml-5">
                    ={" "}
                    {/* Re-render the expression so each [Account] token is
                        clickable — click → filter rules referencing that
                        account. Keeps highlight on global query intact. */}
                    {tokeniseExpression(r.expr, deps, {
                      onClickDep: (dep) => filterRulesByDep(dep),
                      query: q,
                    })}
                  </div>
                </div>
              );
            })}
            {filteredRules.length === 0 && (
              <div className="text-[13px] text-muted-foreground italic px-1 py-6 text-center">
                No rules match that filter.
              </div>
            )}
          </TabsContent>

          <TabsContent value="accounts" className="m-0 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(["PL", "BS", "CF", "KPI"] as const).map((group) => {
                const derivedHere = data.accounts.derived.filter(
                  (d) =>
                    d.group === group &&
                    (!q || matchesQuery(d.id) || matchesQuery(d.rule))
                );
                const leavesHere = data.accounts.leaves.filter(
                  (l) => l.group === group && (!q || matchesQuery(l.id))
                );
                if (q && derivedHere.length === 0 && leavesHere.length === 0) return null;
                return (
                  <Card key={group} className="p-4 shadow-none">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[13px] font-semibold">{GROUP_LABEL[group]}</span>
                      <span className="text-[11.5px] text-muted-foreground tabular-nums">
                        {derivedHere.length + leavesHere.length}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {derivedHere.map((d) => {
                        const rules = rulesByDep.get(d.id);
                        return (
                          <button
                            key={d.id}
                            onClick={() => filterRulesByDep(d.id)}
                            title={`${d.rule}${
                              rules
                                ? ` · referenced by ${rules.size} rule${rules.size === 1 ? "" : "s"}`
                                : ""
                            }`}
                            className="w-full flex items-center gap-1.5 text-[12.5px] font-mono hover:text-accent-blue transition text-left"
                          >
                            <span className="inline-flex items-center justify-center h-4 w-4 rounded-sm bg-accent-blue/15 text-accent-blue font-semibold text-[10px]">
                              ƒ
                            </span>
                            <HighlightText text={d.id} query={q} />
                          </button>
                        );
                      })}
                      {leavesHere.map((l) => {
                        const rules = rulesByDep.get(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => rules && filterRulesByDep(l.id)}
                            disabled={!rules}
                            title={
                              rules
                                ? `Referenced by ${rules.size} rule${rules.size === 1 ? "" : "s"}`
                                : "Leaf · stored directly"
                            }
                            className="w-full flex items-center gap-1.5 text-[12.5px] font-mono text-muted-foreground hover:text-accent-blue transition text-left disabled:hover:text-muted-foreground disabled:cursor-default"
                          >
                            <span className="inline-flex items-center justify-center h-4 w-4 rounded-sm bg-muted text-muted-foreground/80 font-medium text-[10px]">
                              ·
                            </span>
                            <HighlightText text={l.id} query={q} />
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
            <div className="mt-4 text-[12px] text-muted-foreground flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-sm bg-accent-blue/15 text-accent-blue font-semibold text-[10px]">
                  ƒ
                </span>
                Derived — click to see rules referencing it
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-sm bg-muted text-muted-foreground/80 font-medium text-[10px]">
                  ·
                </span>
                Leaf — stored directly in the cube
              </span>
            </div>
          </TabsContent>

          <TabsContent value="sample" className="m-0 p-5">
            <SampleData />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

interface SampleResponse {
  account: string;
  period: string;
  versions: { id: string; label: string }[];
  rows: Array<{
    entityId: string;
    entityLabel: string;
    industry: string | null;
    geography: string | null;
    cells: Array<{ version: string; label: string; value: number | null }>;
  }>;
}

function SampleData() {
  const [account, setAccount] = useState("Revenue");
  const { data, isLoading } = useQuery({
    queryKey: ["schema-sample", account],
    queryFn: async () => {
      const r = await fetch(`/api/schema/sample?account=${encodeURIComponent(account)}`);
      if (!r.ok) throw new Error("Sample fetch failed");
      return (await r.json()) as SampleResponse;
    },
    staleTime: 60_000,
  });

  const accountOptions = ["Revenue", "EBITDA", "EBITDAMarginPct", "NetDebt", "FCF"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-muted-foreground">Account:</span>
        {accountOptions.map((a) => (
          <button
            key={a}
            onClick={() => setAccount(a)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] transition ${
              account === a
                ? "bg-accent-blue text-background"
                : "border border-border/80 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="text-[12px] text-muted-foreground">
        Live slice of <span className="font-mono text-foreground">{account}</span> at{" "}
        <span className="font-mono text-foreground">{data?.period ?? "…"}</span> across 6 entities ·
        every value comes from <span className="font-mono">resolve()</span>. Click any number for
        full cell detail.
      </div>

      <div className="overflow-x-auto rounded-md border border-border/70">
        <table className="w-full text-[13px] border-collapse">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-medium">
            <tr>
              <th className="px-3 py-2 text-left">Entity</th>
              <th className="px-3 py-2 text-left">Industry · Geo</th>
              {data?.versions.map((v) => (
                <th key={v.id} className="px-3 py-2 text-right">
                  {v.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground italic">
                  loading…
                </td>
              </tr>
            )}
            {data?.rows.map((row) => (
              <tr key={row.entityId} className="hover:bg-muted/30 transition">
                <td className="px-3 py-2 font-mono text-[11.5px]">
                  {row.entityLabel}
                  <div className="text-[10px] text-muted-foreground">{row.entityId}</div>
                </td>
                <td className="px-3 py-2 text-[11.5px] text-muted-foreground">
                  {[row.industry, row.geography].filter(Boolean).join(" · ") || "—"}
                </td>
                {row.cells.map((c) => (
                  <td
                    key={c.version}
                    className="px-3 py-2 text-right tabular-nums font-mono text-[12px]"
                  >
                    {c.value === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <CubeCell
                        ref_={{
                          entity: row.entityId,
                          account,
                          time: data.period,
                          version: c.version,
                        }}
                        value={c.value}
                        compact
                        className="hover:text-accent-blue"
                      >
                        {formatCellValueCompact(c.value, account)}
                      </CubeCell>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Render a rule expression with each [Account] token clickable. Non-bracketed
// text keeps the global-search highlight.
function tokeniseExpression(
  expr: string,
  _deps: string[],
  { onClickDep, query }: { onClickDep: (dep: string) => void; query: string }
) {
  const parts: React.ReactNode[] = [];
  const re = /\[([A-Za-z0-9_]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) {
    if (m.index > last) {
      const plain = expr.slice(last, m.index);
      parts.push(
        <span key={`p${last}`}>
          <HighlightText text={plain} query={query} />
        </span>
      );
    }
    const dep = m[1];
    parts.push(
      <button
        key={`d${m.index}`}
        onClick={() => onClickDep(dep)}
        className="text-accent-blue hover:underline underline-offset-2"
        title={`Filter rules referencing ${dep}`}
      >
        [{dep}]
      </button>
    );
    last = m.index + m[0].length;
  }
  if (last < expr.length) {
    parts.push(
      <span key={`p${last}`}>
        <HighlightText text={expr.slice(last)} query={query} />
      </span>
    );
  }
  return <>{parts}</>;
}
