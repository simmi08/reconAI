"use client";

import { useState, type ReactNode } from "react";

type TabId = "documents" | "json" | "checks" | "timeline";

export function DetailTabs({
  documents,
  extracted,
  checks,
  timeline
}: {
  documents: ReactNode;
  extracted: ReactNode;
  checks: ReactNode;
  timeline: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("documents");

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "documents", label: "Documents" },
    { id: "json", label: "Extracted JSON" },
    { id: "checks", label: "Checks" },
    { id: "timeline", label: "Timeline" }
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded px-3 py-1 text-sm ${
              activeTab === tab.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "documents" ? documents : null}
      {activeTab === "json" ? extracted : null}
      {activeTab === "checks" ? checks : null}
      {activeTab === "timeline" ? timeline : null}
    </div>
  );
}
