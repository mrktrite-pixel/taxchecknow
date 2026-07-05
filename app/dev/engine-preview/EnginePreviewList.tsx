"use client";

/**
 * Client wrapper for the dev preview — supplies the onCheckout STUB (a function
 * can't be passed from the server page across the client boundary). Renders each
 * fixture's EngineCalculator and surfaces the stubbed checkout handoff on-page.
 */

import { useState } from "react";
import EngineCalculator, { type Engine, type EngineCheckout } from "@/app/_components/EngineCalculator";
import type { EngineFigure } from "@/app/_components/engine-terms";
import type { EngineConfig } from "@/app/_components/engine-config";

export interface PreviewFixture {
  key: string;
  title: string;
  note: string;
  engine: Engine;
  figures: EngineFigure[];
  config: EngineConfig;
}

export default function EnginePreviewList({ fixtures }: { fixtures: PreviewFixture[] }) {
  const [lastCheckout, setLastCheckout] = useState<Record<string, EngineCheckout | null>>({});

  return (
    <div className="space-y-12">
      {fixtures.map((f) => (
        <section key={f.key}>
          <h2 className="mb-1 font-mono text-sm font-bold text-neutral-700">{f.title}</h2>
          <p className="mb-4 text-xs text-neutral-500">{f.note}</p>
          <EngineCalculator
            engine={f.engine}
            figures={f.figures}
            config={f.config}
            onCheckout={(c) => setLastCheckout((prev) => ({ ...prev, [f.key]: c }))}
          />
          {lastCheckout[f.key] && (
            <p className="mt-2 font-mono text-[11px] text-emerald-700">
              ✓ checkout stub fired — tier {lastCheckout[f.key]!.tier} · ${lastCheckout[f.key]!.price} ·
              terminal {lastCheckout[f.key]!.terminal.id} · qual {JSON.stringify(lastCheckout[f.key]!.qualification)}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
