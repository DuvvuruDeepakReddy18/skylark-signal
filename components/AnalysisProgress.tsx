"use client";

import { Check, LoaderCircle } from "lucide-react";

const steps = [
  "Understanding question",
  "Querying Monday.com",
  "Normalizing records",
  "Checking data quality",
  "Calculating business signal",
];

export function AnalysisProgress({ activeStep }: { activeStep: number }) {
  return (
    <div className="analysis-progress" role="status" aria-live="polite">
      <div className="progress-orbit"><span /><span /><span /></div>
      <div>
        <p className="kicker">Analysis in progress</p>
        <div className="progress-steps">
          {steps.map((step, index) => (
            <span className={index < activeStep ? "complete" : index === activeStep ? "active" : "pending"} key={step}>
              {index < activeStep ? <Check size={13} /> : index === activeStep ? <LoaderCircle size={13} className="spin" /> : <i />}
              {step}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
