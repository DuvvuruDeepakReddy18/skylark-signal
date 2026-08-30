"use client";

import type { SectorSignal } from "@/lib/types";
import { formatInr } from "@/lib/utils";

interface SignalMapProps {
  signals: SectorSignal[];
}

export function SignalMap({ signals }: SignalMapProps) {
  const visible = signals.slice(0, 6);
  return (
    <section className="signal-map" aria-labelledby="signal-map-title">
      <div className="signal-map-heading">
        <div>
          <p className="kicker">Cross-board intelligence</p>
          <h2 id="signal-map-title">Signal map</h2>
        </div>
        <p>Pipeline strength × execution health</p>
      </div>
      <div className="signal-map-canvas">
        <div className="radar-ring ring-one" aria-hidden="true" />
        <div className="radar-ring ring-two" aria-hidden="true" />
        <div className="radar-axis axis-x" aria-hidden="true" />
        <div className="radar-axis axis-y" aria-hidden="true" />
        {visible.map((signal, index) => (
          <div
            className={`sector-node node-${index + 1} ${signal.overall}`}
            key={signal.sector}
            tabIndex={0}
            aria-label={`${signal.sector}: ${signal.overall}; pipeline ${formatInr(signal.pipelineValue)}; execution health ${signal.executionScore}%`}
          >
            <span className="node-pulse" />
            <strong>{signal.sector}</strong>
            <small>{formatInr(signal.pipelineValue)} · {signal.executionScore}%</small>
          </div>
        ))}
        {!visible.length && <div className="map-empty">Waiting for sector data</div>}
      </div>
      <div className="map-legend">
        <span><i className="healthy" /> Healthy</span>
        <span><i className="watch" /> Watch</span>
        <span><i className="risk" /> Risk</span>
      </div>
    </section>
  );
}
