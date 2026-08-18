"use client";

const REPORT_URL = "https://disaster-study2026.vercel.app/";
const TECH_URL = "https://fudy-paper-structure.vercel.app/";

export function SiteNavigation({
  page,
  onNavigateFlow,
  onNavigateScenarios,
}: {
  page: "flow" | "scenarios";
  onNavigateFlow?: () => void;
  onNavigateScenarios?: () => void;
}) {
  return (
    <nav className="site-navigation" aria-label="主要導覽">
      <a
        href="#"
        aria-current={page === "flow" ? "page" : undefined}
        onClick={(event) => {
          if (!onNavigateFlow) return;
          event.preventDefault();
          onNavigateFlow();
        }}
      >
        服務流程分析
      </a>
      <a
        href="#/scenarios"
        aria-current={page === "scenarios" ? "page" : undefined}
        onClick={(event) => {
          if (!onNavigateScenarios) return;
          event.preventDefault();
          onNavigateScenarios();
        }}
      >
        關鍵應用情境
      </a>
      <details className="site-report-menu">
        <summary>研究報告<span aria-hidden="true">⌄</span></summary>
        <div>
          <a href={REPORT_URL} target="_blank" rel="noreferrer">未來防災避難關鍵情境研究報告 ↗</a>
          <a href={TECH_URL} target="_blank" rel="noreferrer">永續材料／結構研究報告 ↗</a>
        </div>
      </details>
    </nav>
  );
}

export default function SitePageHeader({
  page,
  title,
  description,
  onNavigateFlow,
}: {
  page: "flow" | "scenarios";
  title: string;
  description: string;
  onNavigateFlow?: () => void;
}) {
  return (
    <header className="pagehead wrap">
      <SiteNavigation page={page} onNavigateFlow={onNavigateFlow} />
      <p className="eyebrow">打包一個家：未來生活的防災避難創新設計</p>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
    </header>
  );
}
