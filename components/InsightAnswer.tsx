"use client";

import type { InsightAnswer as Insight } from "@/lib/types";
import { formatInr } from "@/lib/utils";
import {
  ArrowRight, BarChart3, Check, ChevronDown, CircleAlert, Clipboard, Database, ExternalLink,
  FileSearch, Gauge, Lightbulb, Rows3, ShieldCheck, Sparkles, Target,
} from "lucide-react";
import { useMemo, useState } from "react";

function Confidence({ answer }: { answer: Insight }) {
  return (
    <div className={`confidence-chip ${answer.confidenceLabel.toLowerCase()}`}>
      <Gauge size={14} />
      <span>{answer.confidenceLabel} confidence</span>
      <strong>{answer.confidence}%</strong>
    </div>
  );
}

function MiniBarChart({ answer }: { answer: Insight }) {
  const data = answer.chart?.data ?? [];
  const max = Math.max(...data.map((datum) => Math.abs(datum.value)), 1);
  if (!data.length) return null;
  return (
    <div className="mini-chart">
      <div className="chart-heading"><BarChart3 size={16} /><span>{answer.chart?.title}</span></div>
      {data.slice(0, 7).map((datum) => (
        <div className="chart-row" key={datum.label}>
          <span title={datum.label}>{datum.label.replace(/^[A-Z]\.\s*/, "")}</span>
          <div><i style={{ width: `${Math.max(4, Math.abs(datum.value) / max * 100)}%` }} /></div>
          <strong>{datum.formatted}</strong>
        </div>
      ))}
    </div>
  );
}

export function InsightAnswer({ answer, analystMode }: { answer: Insight; analystMode: boolean }) {
  const [copied, setCopied] = useState(false);
  const copyText = useMemo(
    () => [
      answer.eyebrow,
      answer.headline,
      `Signal: ${answer.signal}`,
      `Risk: ${answer.risk}`,
      `Action: ${answer.action}`,
      `Data quality: ${answer.caveats.join("; ")}`,
      `Sources: ${answer.sources.join(", ")}`,
    ].join("\n\n"),
    [answer],
  );

  const copy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="insight-answer">
      <div className="answer-topline">
        <div className="agent-avatar"><Sparkles size={16} /></div>
        <div><p className="kicker">{answer.eyebrow}</p><span>{answer.plan.explanation}</span></div>
        <button className="copy-button" onClick={copy}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "Copied" : "Copy"}</button>
      </div>

      <div className="answer-hero">
        <div><h2>{answer.headline}</h2><p className="hero-metric"><strong>{answer.keyMetric}</strong><span>{answer.metricLabel}</span></p></div>
        <Confidence answer={answer} />
      </div>

      <div className="answer-sequence" aria-label="Signal evidence action">
        <section className="sequence-block signal-block">
          <div className="sequence-label"><span>01</span><Lightbulb size={16} /> Signal</div>
          <p>{answer.signal}</p>
        </section>
        <section className="sequence-block evidence-block">
          <div className="sequence-label"><span>02</span><FileSearch size={16} /> Evidence</div>
          <div className="evidence-grid">
            {answer.evidence.map((point) => <div className={point.tone ?? "neutral"} key={point.label}><span>{point.label}</span><strong>{point.value}</strong></div>)}
          </div>
        </section>
        <section className="sequence-block action-block">
          <div className="sequence-label"><span>03</span><Target size={16} /> Action</div>
          <p>{answer.action}</p>
          <span className="action-arrow"><ArrowRight size={16} /></span>
        </section>
      </div>

      <div className="risk-strip"><CircleAlert size={16} /><div><strong>Risk</strong><p>{answer.risk}</p></div></div>

      {analystMode && <MiniBarChart answer={answer} />}

      <div className="answer-details">
        <details>
          <summary><ShieldCheck size={16} /><span>Data quality</span><small>{answer.caveats.length} note{answer.caveats.length === 1 ? "" : "s"}</small><ChevronDown size={15} /></summary>
          <div className="detail-body caveat-list">{answer.caveats.length ? answer.caveats.map((caveat) => <p key={caveat}><CircleAlert size={14} />{caveat}</p>) : <p><Check size={14} />No material caveat.</p>}</div>
        </details>
        <details>
          <summary><Database size={16} /><span>View calculation</span><small>{answer.lineage.length} steps</small><ChevronDown size={15} /></summary>
          <div className="detail-body lineage-list">{answer.lineage.map((step, index) => <div key={`${step.label}-${index}`}><i>{index + 1}</i><p><strong>{step.label}</strong><span>{step.detail}</span></p></div>)}</div>
        </details>
        <details>
          <summary><Rows3 size={16} /><span>Supporting records</span><small>{answer.records.length} shown</small><ChevronDown size={15} /></summary>
          <div className="detail-body records-table-wrap">
            {answer.records.length ? <table className="records-table"><thead><tr><th>Record</th><th>Board</th><th>Status</th><th>Value</th><th>Why shown</th></tr></thead><tbody>{answer.records.map((record) => <tr key={`${record.board}-${record.id}`}><td><strong>{record.name}</strong><span>{record.sector ?? "No sector"}</span></td><td>{record.board === "deals" ? "Deals" : "Work Orders"}</td><td>{record.status?.replaceAll("_", " ") ?? "Unknown"}</td><td>{record.value === null ? "—" : formatInr(record.value)}</td><td>{record.reason ?? "Included evidence"}</td></tr>)}</tbody></table> : <p className="empty-records">No supporting record list is needed for this response.</p>}
          </div>
        </details>
      </div>

      <footer className="answer-footer">
        <div>{answer.sources.map((source) => <span key={source}><ExternalLink size={12} />{source}</span>)}</div>
        <small>{answer.plan.planner === "openai" ? "AI-assisted · rule-validated · deterministic calculation" : "Deterministic planner fallback · deterministic calculation"}</small>
      </footer>
    </article>
  );
}
