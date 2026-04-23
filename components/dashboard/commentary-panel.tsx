"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  entityId: string;
  meta: {
    label: string;
    level: string;
    metadata?: { flavor?: string; thesis?: string };
  };
}

export function CommentaryPanel({ entityId, meta }: Props) {
  const router = useRouter();

  const go = (q: string) => router.push(`/ask?q=${encodeURIComponent(q)}`);

  return (
    <Card className="p-5 sticky top-[76px]">
      <div className="text-[14px] font-semibold">Generate commentary</div>
      <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">
        Structured, citation-backed writeup for {meta.label}. Every sentence carries a line item,
        a magnitude and a comparison base.
      </p>
      <div className="mt-4 space-y-2">
        <Button
          size="sm"
          className="w-full h-9 gap-2"
          onClick={() =>
            go(
              `Generate Financial Performance Commentary for ${meta.label}. Cover P&L variance vs Budget and vs Prior Year, decompose drivers, and flag any forecast divergence.`
            )
          }
        >
          <Sparkles className="h-3.5 w-3.5" />
          Financial Performance
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-9 gap-2"
          onClick={() =>
            go(`Generate Fair Valuation Commentary for ${meta.label}. Walk the V1→V2 bridge leg by leg.`)
          }
        >
          <Sparkles className="h-3.5 w-3.5" />
          Fair Valuation
        </Button>
      </div>

      <div className="mt-5 rounded-md border border-dashed border-border bg-muted/30 p-3">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.06em]">
          Sample output
        </div>
        <p className="mt-1.5 text-[12.5px] leading-snug italic text-muted-foreground">
          “{meta.label} EBITDA YTD …M, …% vs Budget; gross margin moved …bps driven by …; forecast
          conservatively reset to …M, …% below prior Mgmt view.”
        </p>
      </div>
    </Card>
  );
}
