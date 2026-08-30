"use client";

import type { BusinessPulse as PulseType } from "@/lib/types";
import { formatInr } from "@/lib/utils";
import { Activity, BadgeIndianRupee, CircleAlert, DatabaseZap, Goal, LoaderCircle } from "lucide-react";

interface BusinessPulseProps {
  pulse?: PulseType;
  loading: boolean;
}

export function BusinessPulse({ pulse, loading }: BusinessPulseProps) {
  const metrics = pulse
    ? [
        { label: "Pipeline", value: formatInr(pulse.pipeline), note: `${pulse.openDeals} open deals`, icon: Goal, tone: "signal" },
        { label: "Billed revenue", value: formatInr(pulse.revenue), note: "Excluding GST", icon: BadgeIndianRupee, tone: "neutral" },
        { label: "Active work orders", value: String(pulse.activeWorkOrders), note: "Not completed", icon: Activity, tone: "neutral" },
        { label: "At-risk operations", value: String(pulse.atRiskOperations), note: "Rule-based", icon: CircleAlert, tone: pulse.atRiskOperations ? "risk" : "signal" },
        { label: "Data quality", value: `${pulse.dataQuality}%`, note: "Reliability score", icon: DatabaseZap, tone: pulse.dataQuality >= 80 ? "signal" : "risk" },
      ]
    : [];

  return (
    <aside className="pulse-panel" aria-label="Business pulse">
      <div className="panel-heading">
        <div>
          <p className="kicker">Business pulse</p>
          <h2>What needs a glance</h2>
        </div>
        <span className="pulse-live"><span /> dynamic</span>
      </div>

      <div className="pulse-metrics">
        {loading
          ? Array.from({ length: 5 }, (_, index) => <div className="metric-skeleton" key={index}><LoaderCircle className="spin" size={17} /></div>)
          : metrics.map(({ label, value, note, icon: Icon, tone }) => (
              <div className={`pulse-metric ${tone}`} key={label}>
                <div className="metric-icon"><Icon size={17} /></div>
                <div className="metric-copy"><span>{label}</span><strong>{value}</strong></div>
                <small>{note}</small>
              </div>
            ))}
      </div>

      <div className="signals-list">
        <div className="signals-title"><span>Proactive signals</span><span>{pulse?.proactiveSignals.length ?? 0}</span></div>
        {loading && <div className="signal-skeleton" />}
        {pulse?.proactiveSignals.map((signal) => (
          <div className={`proactive-signal ${signal.severity}`} key={signal.id}>
            <span className="signal-glyph" aria-hidden="true" />
            <div><strong>{signal.title}</strong><p>{signal.detail}</p></div>
          </div>
        ))}
      </div>
    </aside>
  );
}
