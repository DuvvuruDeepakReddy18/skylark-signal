"use client";

import { AnalysisProgress } from "@/components/AnalysisProgress";
import { BusinessPulse } from "@/components/BusinessPulse";
import { Composer } from "@/components/Composer";
import { Header } from "@/components/Header";
import { InsightAnswer } from "@/components/InsightAnswer";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SignalMap } from "@/components/SignalMap";
import type { BootstrapResponse, ChatResponse, ConversationContext, InsightAnswer as Insight } from "@/lib/types";
import { AlertTriangle, ArrowUpRight, BrainCircuit, ChartNoAxesCombined, CircleGauge, RotateCw, Rows3, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const suggestions = [
  { text: "Show me pipeline health this quarter", icon: ChartNoAxesCombined },
  { text: "Which sector has the strongest pipeline?", icon: ArrowUpRight },
  { text: "Which deals need attention?", icon: CircleGauge },
  { text: "Which work orders are at risk?", icon: Rows3 },
  { text: "Compare Renewables sales pipeline with execution", icon: BrainCircuit },
  { text: "Prepare my leadership update", icon: Sparkles },
];

interface ConversationEntry {
  id: string;
  role: "user" | "assistant";
  text?: string;
  answer?: Insight;
}

async function requestBootstrap(force = false): Promise<BootstrapResponse> {
  const response = await fetch(`/api/bootstrap${force ? "?refresh=1" : ""}`, { cache: "no-store" });
  const payload = await response.json() as BootstrapResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Business data could not be loaded.");
  return payload;
}

export function SignalApp() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse>();
  const [bootstrapError, setBootstrapError] = useState<string>();
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [context, setContext] = useState<ConversationContext>({ mentionedSectors: [] });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [requestError, setRequestError] = useState<string>();
  const [analystMode, setAnalystMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const loadBootstrap = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    setBootstrapError(undefined);
    try {
      setBootstrap(await requestBootstrap(force));
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : "Business data could not be loaded.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void requestBootstrap()
      .then((payload) => { if (!cancelled) setBootstrap(payload); })
      .catch((error: unknown) => {
        if (!cancelled) setBootstrapError(error instanceof Error ? error.message : "Business data could not be loaded.");
      });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [conversation, loading]);

  const ask = async (message: string) => {
    if (loading) return;
    setRequestError(undefined);
    setConversation((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: message }]);
    setLoading(true);
    setActiveStep(0);
    const timer = window.setInterval(() => setActiveStep((step) => Math.min(4, step + 1)), 420);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, founderMode: !analystMode, context }),
      });
      const payload = await response.json() as ChatResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Analysis failed.");
      setConversation((current) => [...current, { id: `agent-${Date.now()}`, role: "assistant", answer: payload.answer }]);
      setContext(payload.context);
      if (bootstrap) setBootstrap({ ...bootstrap, connection: payload.connection });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "The analysis could not be completed.");
    } finally {
      window.clearInterval(timer);
      setLoading(false);
    }
  };

  const newAnalysis = () => {
    setConversation([]);
    setContext({ mentionedSectors: [] });
    setRequestError(undefined);
  };

  const isEmpty = conversation.length === 0;

  return (
    <div className="app-shell">
      <Header
        connection={bootstrap?.connection}
        onNew={newAnalysis}
        onRefresh={() => void loadBootstrap(true)}
        onSettings={() => setSettingsOpen(true)}
        refreshing={refreshing}
      />

      <div className="app-grid">
        <main className="analysis-workspace">
          {bootstrap?.connection.warning && <div className="mode-banner"><AlertTriangle size={15} /><span>{bootstrap.connection.warning}</span></div>}
          {bootstrapError && (
            <div className="error-banner"><AlertTriangle size={17} /><div><strong>I couldn’t load business data.</strong><p>{bootstrapError}</p></div><button onClick={() => void loadBootstrap()}><RotateCw size={14} /> Retry</button></div>
          )}

          {isEmpty ? (
            <div className="hero-state">
              <div className="hero-orbit" aria-hidden="true"><i /><i /><i /><span><Sparkles size={22} /></span></div>
              <p className="kicker">Founder intelligence workspace</p>
              <h1>Ask anything about<br /><em>your business.</em></h1>
              <p className="hero-subtitle">A decision layer over Monday.com that separates the signal from the noise—and shows its work.</p>
              <Composer onSubmit={(message) => void ask(message)} disabled={loading || Boolean(bootstrapError)} />
              <div className="mode-switch" role="group" aria-label="Answer detail mode">
                <button className={!analystMode ? "active" : ""} onClick={() => setAnalystMode(false)}><Sparkles size={14} /> Founder mode</button>
                <button className={analystMode ? "active" : ""} onClick={() => setAnalystMode(true)}><Rows3 size={14} /> Analyst mode</button>
              </div>
              <div className="suggestions"><span>Try a question</span><div>{suggestions.map(({ text, icon: Icon }) => <button key={text} onClick={() => void ask(text)} disabled={loading || Boolean(bootstrapError)}><Icon size={14} />{text}</button>)}</div></div>
            </div>
          ) : (
            <div className="conversation-view">
              <div className="conversation-header"><div><p className="kicker">Current analysis</p><h1>Founder workspace</h1></div><div className="mode-switch small"><button className={!analystMode ? "active" : ""} onClick={() => setAnalystMode(false)}>Founder</button><button className={analystMode ? "active" : ""} onClick={() => setAnalystMode(true)}>Analyst</button></div></div>
              <div className="conversation-feed">
                {conversation.map((entry) => entry.role === "user"
                  ? <div className="user-message" key={entry.id}><span>You</span><p>{entry.text}</p></div>
                  : entry.answer && <InsightAnswer answer={entry.answer} analystMode={analystMode} key={entry.id} />)}
                {loading && <AnalysisProgress activeStep={activeStep} />}
                {requestError && <div className="analysis-error"><AlertTriangle size={17} /><div><strong>I couldn’t complete that analysis.</strong><p>{requestError}</p></div><button onClick={() => setRequestError(undefined)}>Dismiss</button></div>}
                <div ref={feedEndRef} />
              </div>
              <div className="sticky-composer"><Composer onSubmit={(message) => void ask(message)} disabled={loading} compact /></div>
            </div>
          )}
        </main>

        <div className="intelligence-rail">
          <BusinessPulse pulse={bootstrap?.pulse} loading={!bootstrap && !bootstrapError} />
          <SignalMap signals={bootstrap?.pulse.sectorSignals ?? []} />
        </div>
      </div>

      {settingsOpen && <SettingsDialog connection={bootstrap?.connection} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
