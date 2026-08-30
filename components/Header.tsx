"use client";

import type { BootstrapResponse } from "@/lib/types";
import { Clock3, Plus, RotateCw, Settings2 } from "lucide-react";

interface HeaderProps {
  connection?: BootstrapResponse["connection"];
  onNew: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  refreshing: boolean;
}

function relativeTime(iso?: string): string {
  if (!iso) return "Waiting for first sync";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Refreshed just now";
  const minutes = Math.round(seconds / 60);
  return `Refreshed ${minutes} min ago`;
}

export function Header({ connection, onNew, onRefresh, onSettings, refreshing }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup" aria-label="Skylark Signal">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <div className="brand-name">Skylark Signal</div>
          <div className="brand-tagline">Ask the business. See the signal.</div>
        </div>
      </div>

      <div className="connection-cluster">
        <button className={`connection-pill ${connection?.freshness ?? "loading"}`} onClick={onRefresh} disabled={refreshing}>
          <span className="status-dot" aria-hidden="true" />
          <span>{connection?.label ?? "Connecting to data"}</span>
          <RotateCw size={13} className={refreshing ? "spin" : ""} aria-hidden="true" />
        </button>
        <span className="refresh-time"><Clock3 size={13} /> {relativeTime(connection?.fetchedAt)}</span>
      </div>

      <div className="topbar-actions">
        <button className="icon-button" onClick={onSettings} aria-label="Connection settings"><Settings2 size={18} /></button>
        <button className="new-analysis-button" onClick={onNew}><Plus size={17} /> New analysis</button>
      </div>
    </header>
  );
}
