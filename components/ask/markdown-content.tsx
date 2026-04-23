"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Highlight, themes } from "prism-react-renderer";
import type { ComponentProps, ReactNode } from "react";
import { Fragment } from "react";
import { CitationChip } from "@/components/citation-chip";
import type { CellRef } from "@/lib/jedox/schema";
import type { SectionCitation } from "@/lib/agents/events";

// Token we inject before handing the text to react-markdown, so the `[cite:N]`
// payload passes through untouched. We split text nodes on this token in the
// custom renderer to drop in real <CitationChip> components inline.
const CITE_OPEN = "⁣CITE⁣";
const CITE_CLOSE = "⁣ENDCITE⁣";

function replaceMarkers(body: string): string {
  return body.replace(/\[cite:(\d+)\]/g, (_, n) => `${CITE_OPEN}${n}${CITE_CLOSE}`);
}

function renderWithCitations(
  children: ReactNode,
  byId: Map<number, SectionCitation>
): ReactNode {
  if (typeof children === "string") return splitText(children, byId);
  if (Array.isArray(children)) {
    return children.map((c, i) => (
      <Fragment key={i}>{renderWithCitations(c, byId)}</Fragment>
    ));
  }
  return children;
}

function splitText(text: string, byId: Map<number, SectionCitation>): ReactNode {
  const parts: ReactNode[] = [];
  const regex = new RegExp(`${CITE_OPEN}(\\d+)${CITE_CLOSE}`, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const id = Number(match[1]);
    const c = byId.get(id);
    if (c) {
      const cellRef: CellRef = {
        cube: "FIN_CUBE",
        entity: c.entity,
        account: c.account,
        time: c.period,
        version: c.version,
        currency: "EUR",
        measure: "Value",
      };
      parts.push(
        <CitationChip
          key={`c${match.index}`}
          n={id}
          cellRef={cellRef}
          value={c.value}
          label={`${c.account} · ${c.entity}`}
        />
      );
    } else {
      // Dangling marker — render as plain superscript so it's still visible.
      parts.push(
        <sup key={`d${match.index}`} className="text-destructive/70 font-mono text-[10px]">
          [{id}?]
        </sup>
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const cleaned = code.replace(/\n$/, "");
  return (
    <div className="relative my-4 rounded-lg overflow-hidden border border-border/70 bg-[#0b0f19]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 text-[11px] font-mono text-white/60">
        <span>{language || "text"}</span>
      </div>
      <Highlight code={cleaned} language={language || "python"} theme={themes.vsDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} overflow-x-auto px-4 py-3 text-[12.5px] leading-[1.55] font-mono`}
            style={style}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

export function MarkdownContent({
  body,
  citations = [],
  className = "",
}: {
  body: string;
  citations?: SectionCitation[];
  className?: string;
}) {
  const byId = new Map<number, SectionCitation>();
  for (const c of citations) byId.set(c.id, c);
  const text = replaceMarkers(body);

  return (
    <div
      className={`prose-unity text-[15px] leading-[1.7] text-foreground/90 max-w-none ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }: ComponentProps<"p">) => (
            <p className="mb-3.5 last:mb-0">{renderWithCitations(children, byId)}</p>
          ),
          strong: ({ children }: ComponentProps<"strong">) => (
            <strong className="font-semibold text-foreground">
              {renderWithCitations(children, byId)}
            </strong>
          ),
          em: ({ children }: ComponentProps<"em">) => (
            <em className="italic">{renderWithCitations(children, byId)}</em>
          ),
          li: ({ children }: ComponentProps<"li">) => (
            <li className="ml-5 mb-1.5 marker:text-muted-foreground/60 pl-1 leading-[1.6]">
              {renderWithCitations(children, byId)}
            </li>
          ),
          ol: ({ children }: ComponentProps<"ol">) => (
            <ol className="pl-2 mb-3.5 list-decimal space-y-0.5 marker:text-muted-foreground/70 marker:font-medium">
              {children}
            </ol>
          ),
          ul: ({ children }: ComponentProps<"ul">) => (
            <ul className="pl-2 mb-3.5 list-disc space-y-0.5">{children}</ul>
          ),
          h1: ({ children }: ComponentProps<"h1">) => (
            <h2 className="text-[19px] font-semibold mt-5 mb-2 tracking-tight">
              {children}
            </h2>
          ),
          h2: ({ children }: ComponentProps<"h2">) => (
            <h3 className="text-[16.5px] font-semibold mt-4 mb-1.5 tracking-tight">
              {children}
            </h3>
          ),
          h3: ({ children }: ComponentProps<"h3">) => (
            <h4 className="text-[14.5px] font-semibold mt-3.5 mb-1 text-foreground/90 uppercase tracking-wider">
              {children}
            </h4>
          ),
          table: ({ children }: ComponentProps<"table">) => (
            <div className="my-4 overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-[13px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }: ComponentProps<"thead">) => (
            <thead className="bg-muted/60 text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-medium">
              {children}
            </thead>
          ),
          tbody: ({ children }: ComponentProps<"tbody">) => (
            <tbody className="divide-y divide-border/60">{children}</tbody>
          ),
          tr: ({ children }: ComponentProps<"tr">) => (
            <tr className="hover:bg-muted/30 transition">{children}</tr>
          ),
          th: ({ children, style }: ComponentProps<"th">) => (
            <th
              className="px-3 py-2 text-left font-medium first:pl-4 last:pr-4 [&[data-align='right']]:text-right"
              style={style}
            >
              {renderWithCitations(children, byId)}
            </th>
          ),
          td: ({ children, style }: ComponentProps<"td">) => {
            // Right-align numeric cells (detected heuristically by a % or digit prefix).
            const txt =
              typeof children === "string"
                ? children
                : Array.isArray(children)
                ? children.join("")
                : "";
            const isNumeric =
              /^\s*[−-]?[€$£]?\s*[\d(]/.test(String(txt)) ||
              String(txt).trim().endsWith("%") ||
              String(txt).trim().endsWith("bps");
            return (
              <td
                className={`px-3 py-1.5 first:pl-4 last:pr-4 ${
                  isNumeric ? "text-right tabular-nums font-mono text-[12.5px]" : ""
                }`}
                style={style}
              >
                {renderWithCitations(children, byId)}
              </td>
            );
          },
          code: ({ children, className: cn }: ComponentProps<"code">) => {
            // react-markdown passes language via class="language-xxx" for fenced
            // blocks. Inline code has no language class.
            const match = /language-(\w+)/.exec(cn ?? "");
            if (match) {
              return (
                <CodeBlock
                  language={match[1]}
                  code={typeof children === "string" ? children : String(children)}
                />
              );
            }
            return (
              <code className="rounded bg-muted/70 px-1 py-0.5 text-[13px] font-mono text-foreground">
                {children}
              </code>
            );
          },
          pre: ({ children }: ComponentProps<"pre">) => {
            // react-markdown nests <code> inside <pre>; our CodeBlock already
            // renders its own <pre>. Unwrap so we don't double-wrap.
            return <>{children}</>;
          },
          blockquote: ({ children }: ComponentProps<"blockquote">) => (
            <blockquote className="border-l-2 border-accent-blue/50 pl-3.5 text-foreground/85 my-4 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }: ComponentProps<"a">) => (
            <a
              href={href}
              className="text-accent-blue hover:underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-5 border-t border-border/70" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
