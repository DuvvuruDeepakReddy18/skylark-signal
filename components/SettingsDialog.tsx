"use client";

import type { BootstrapResponse } from "@/lib/types";
import { CheckCircle2, KeyRound, ServerCog, X } from "lucide-react";

export function SettingsDialog({ connection, onClose }: { connection?: BootstrapResponse["connection"]; onClose: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="Close settings"><X size={18} /></button>
        <p className="kicker">Connection</p>
        <h2 id="settings-title">Server-side data configuration</h2>
        <p>Secrets are never accepted in the browser. Live mode reads three protected deployment variables.</p>
        <div className="settings-status"><span className={`status-dot ${connection?.freshness ?? "loading"}`} /><div><strong>{connection?.label ?? "Not loaded"}</strong><small>{connection?.warning ?? "Connection state is disclosed on every analysis."}</small></div></div>
        <div className="settings-steps">
          <div><KeyRound size={17} /><p><strong>MONDAY_API_TOKEN</strong><span>Read-only-capable personal or OAuth token with access to both boards.</span></p></div>
          <div><ServerCog size={17} /><p><strong>Board IDs</strong><span>MONDAY_DEALS_BOARD_ID and MONDAY_WORK_ORDERS_BOARD_ID.</span></p></div>
          <div><CheckCircle2 size={17} /><p><strong>Safe fallback</strong><span>Without configuration, the app stays in visibly labelled simulated Demo Mode.</span></p></div>
        </div>
        <code>DATA_MODE=auto · MONDAY_API_VERSION=2026-07</code>
      </section>
    </div>
  );
}
