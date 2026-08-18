"use client";

import { useEffect, useMemo, useState } from "react";
import fallbackData from "./data/sheet-fallback.json";
import sceneDetail from "./data/scene-detail.json";
import audienceStageDetails from "./data/audience-stage-details.json";
import ScenarioExperience from "./scenario-experience";
import SitePageHeader from "./site-page-header";
import HorizontalScroll from "./horizontal-scroll";

type Cell = string | number | boolean | null | undefined;
type SheetBlock = { range?: string; values: Cell[][] };
type SheetBundle = {
  main: SheetBlock;
  scenarios?: SheetBlock;
  media?: SheetBlock;
};

type MainRecord = Record<string, string>;

type StageKey = "prep" | "response" | "shelter" | "recovery";
type AudienceStageSource = {
  no: string;
  name: string;
  time: string;
  focus: string;
  phaseDescription: string;
  illustration: string | null;
  summary: string;
  details: string[];
  example: string | null;
  exampleImages: string[];
  sources: { label: string; url: string }[];
};
type AudienceSource = {
  id: string;
  label: string;
  subLabel: string;
  accent: string;
  stages: Record<StageKey, AudienceStageSource>;
};
type OpenAudienceStage = { audienceId: string; stageKey: StageKey };

const GROUPS = [
  { id: "G01", label: "高齡者", members: ["G01"] },
  { id: "G02", label: "多元文化者", members: ["G02"] },
  { id: "G03", label: "親子家庭", members: ["G03"] },
  { id: "PET", label: "寵物家庭", members: ["G04", "G05", "G06"] },
] as const;

const GROUP_LABELS: Record<string, string> = {
  G01: "高齡者",
  G02: "多元文化者",
  G03: "親子家庭",
  G04: "中小型犬",
  G05: "貓",
  G06: "特寵",
  PET_COMMON: "寵物家庭共通",
};

const PET_GROUP_IDS = ["G04", "G05", "G06"];
const PET_SHARED_SCENE_ID = "C03";

const AUDIENCE_SOURCES = audienceStageDetails as AudienceSource[];
const AUDIENCE_ID_BY_GROUP: Record<string, string> = {
  G01: "elderly",
  G02: "multicultural",
  G03: "family",
  G04: "pets",
  G05: "pets",
  G06: "pets",
  PET_COMMON: "pets",
};
const STAGE_BY_SCENE: Record<string, StageKey> = {
  C01: "prep",
  C02: "prep",
  C03: "response",
  C04: "response",
  C05: "response",
  C06: "shelter",
  C07: "recovery",
};
const STAGE_CLUSTERS: { key: StageKey; start: number; span: number }[] = [
  { key: "prep", start: 2, span: 2 },
  { key: "response", start: 4, span: 3 },
  { key: "shelter", start: 7, span: 1 },
  { key: "recovery", start: 8, span: 1 },
];


const PHASES = [
  { label: "備災期", start: 2, span: 2 },
  { label: "緊急應變期", start: 4, span: 3 },
  { label: "緊急避難期", start: 7, span: 1 },
  { label: "中長期收容與復原期", start: 8, span: 1 },
];

const TIMES = [
  { label: "災前", start: 2, span: 2 },
  { label: "0–3天（72小時）", start: 4, span: 3 },
  { label: "3–14日", start: 7, span: 1 },
  { label: "14日–六個月以上", start: 8, span: 1 },
];

function rowsToObjects(values: Cell[][]): Record<string, string>[] {
  const [header = [], ...rows] = values;
  const keys = header.map((cell) => String(cell ?? ""));
  return rows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row) =>
      Object.fromEntries(keys.map((key, index) => [key, String(row[index] ?? "")]))
    );
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•*-]\s*/, "").trim())
    .filter(Boolean);
}


const FALLBACK_SCENE_SUMMARIES: Record<string, string[]> = {
  C01: ["有限空間與儲備體積的衝突", "降低備災物資的拿取阻力", "建立物資維護與更換機制"],
  C02: ["讓減災演練融入日常", "建立社區協作與互助網絡", "降低不同族群的參與門檻"],
  C03: ["快速辨識與取得合適物資", "兼顧公平分配與特殊需求", "降低資訊與動線混亂"],
  C04: ["建立可調整的休息與隱私空間", "兼顧睡眠品質與安全管理", "回應不同身體與生活需求"],
  C05: ["維持基本衛生與如廁尊嚴", "降低清潔、氣味與感染風險", "提供不同族群可使用的設施"],
  C06: ["重建日常協作與集體安全感", "提供友善交流與情感支持空間", "回應文化、家庭與社群差異"],
  C07: ["讓物資順利回收並再次使用", "建立清楚的交接與追蹤機制", "支持返家後的持續安置"],
};

function compactNeed(sceneId: string, summary: string, fullText: string) {
  const sheetSummary = splitLines(summary);
  if (sheetSummary.length) return sheetSummary;
  if (FALLBACK_SCENE_SUMMARIES[sceneId]) return FALLBACK_SCENE_SUMMARIES[sceneId];
  return splitLines(fullText).map((line) => {
    const separator = line.indexOf("：");
    return separator > 0 ? line.slice(0, separator) : line;
  });
}

function MainContent() {
  const [bundle, setBundle] = useState<SheetBundle>(fallbackData as SheetBundle);
  const [dataSource, setDataSource] = useState<"fallback" | "live">("fallback");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [openScene, setOpenScene] = useState<string | null>(null);
  const [openAudienceStage, setOpenAudienceStage] = useState<OpenAudienceStage | null>(null);
  const [hoveredAudienceStage, setHoveredAudienceStage] = useState<string | null>(null);

  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_SHEET_API_URL;
    if (!endpoint) return;

    const controller = new AbortController();
    fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Sheet data unavailable");
        return response.json();
      })
      .then((data: SheetBundle) => {
        if (data?.main?.values?.length) {
          setBundle(data);
          setDataSource("live");
        }
      })
      .catch(() => {
        // Keep the verified local fallback when the live sheet is unavailable.
      });

    return () => controller.abort();
  }, []);

  const records = useMemo(
    () => rowsToObjects(bundle.main.values) as MainRecord[],
    [bundle]
  );

  const scenes = useMemo(() => {
    const seen = new Map<string, MainRecord>();
    records.forEach((record) => {
      if (record["場景ID"] && !seen.has(record["場景ID"])) {
        seen.set(record["場景ID"], record);
      }
    });
    return [...seen.values()].sort((a, b) =>
      a["場景ID"].localeCompare(b["場景ID"])
    );
  }, [records]);

  const sceneIds = useMemo(
    () => scenes.map((scene) => scene["場景ID"]),
    [scenes]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (openAudienceStage) setOpenAudienceStage(null);
        else if (openScene) setOpenScene(null);
      }
      if (!openAudienceStage && openScene && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        const index = sceneIds.indexOf(openScene);
        const offset = event.key === "ArrowLeft" ? -1 : 1;
        setOpenScene(sceneIds[(index + offset + sceneIds.length) % sceneIds.length]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openAudienceStage, openScene, sceneIds]);

  useEffect(() => {
    if (!openScene && !openAudienceStage) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openAudienceStage, openScene]);

  const visibleGroupIds = GROUPS.filter(
    (group) => selectedGroups.has(group.id)
  ).flatMap((group) => group.members);

  const displayedGroupIds = visibleGroupIds;
  const showPetSpeciesRows = PET_GROUP_IDS.every((id) => displayedGroupIds.includes(id));
  const standardGroupIds = displayedGroupIds.filter((id) => !PET_GROUP_IDS.includes(id));

  function toggleGroup(groupId: string) {
    setSelectedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function recordFor(sceneId: string, groupId: string) {
    if (groupId === "PET_COMMON") {
      return records.find(
        (record) =>
          record["場景ID"] === sceneId &&
          PET_GROUP_IDS.includes(record["族群ID"])
      );
    }
    return records.find(
      (record) => record["場景ID"] === sceneId && record["族群ID"] === groupId
    );
  }

  function summaryFor(sceneId: string) {
    return records.find(
      (record) => record["場景ID"] === sceneId && record["場景需求摘要"]
    )?.["場景需求摘要"] ?? "";
  }

  function petFieldIsShared(sceneId: string, field: string) {
    if (sceneId !== PET_SHARED_SCENE_ID) return false;
    const values = PET_GROUP_IDS.map((groupId) => recordFor(sceneId, groupId)?.[field] ?? "");
    return Boolean(values[0]) && values.every((value) => value === values[0]);
  }

  function audienceStageKey(groupId: string, sceneId: string) {
    const audienceId = AUDIENCE_ID_BY_GROUP[groupId];
    const stageKey = STAGE_BY_SCENE[sceneId];
    return audienceId && stageKey ? `${audienceId}-${stageKey}` : null;
  }

  function openAudienceStageFor(groupId: string, sceneId: string) {
    const audienceId = AUDIENCE_ID_BY_GROUP[groupId];
    const stageKey = STAGE_BY_SCENE[sceneId];
    if (audienceId && stageKey) setOpenAudienceStage({ audienceId, stageKey });
  }

  function audienceStageAriaLabel(groupId: string, sceneId: string) {
    const audienceId = AUDIENCE_ID_BY_GROUP[groupId];
    const stageKey = STAGE_BY_SCENE[sceneId];
    const audience = AUDIENCE_SOURCES.find((item) => item.id === audienceId);
    return `展開${audience?.label ?? GROUP_LABELS[groupId]}${audience?.stages[stageKey]?.name ?? ""}詳細情境`;
  }

  function stageOutlines(audienceId: string, petGrid = false) {
    return STAGE_CLUSTERS.map((cluster) => {
      const key = `${audienceId}-${cluster.key}`;
      return (
        <span
          aria-hidden="true"
          className={`audience-stage-outline ${hoveredAudienceStage === key ? "is-visible" : ""}`}
          key={`outline-${key}`}
          style={{
            gridColumn: `${cluster.start} / span ${cluster.span}`,
            gridRow: petGrid ? "1 / span 3" : 1,
          }}
        />
      );
    });
  }

  function renderPetRows(field: string, provider = false) {
    const interactive = !provider;
    return (
      <div className={`pet-group-grid ${provider ? "pet-provider-grid" : ""}`}>
        {PET_GROUP_IDS.map((groupId, rowIndex) => (
          <div
            className="row-label"
            key={`${field}-label-${groupId}`}
            style={{ gridColumn: 1, gridRow: rowIndex + 1 }}
          >
            {GROUP_LABELS[groupId]}{provider ? "因應策略" : ""}
          </div>
        ))}

        {interactive && stageOutlines("pets", true)}

        {scenes.flatMap((scene, sceneIndex) => {
          const sceneId = scene["場景ID"];
          const gridColumn = sceneIndex + 2;
          const interactionKey = audienceStageKey("G04", sceneId);
          if (petFieldIsShared(sceneId, field)) {
            const record = recordFor(sceneId, PET_GROUP_IDS[0]);
            return [
              <DataCard
                key={`${field}-${sceneId}-pet-common`}
                content={record?.[field]}
                provider={provider}
                className="pet-shared-card"
                layoutStyle={{ gridColumn, gridRow: "1 / span 3" }}
                interactive={interactive}
                showArrow={interactive}
                ariaLabel={interactive ? audienceStageAriaLabel("G04", sceneId) : undefined}
                onClick={interactive ? () => openAudienceStageFor("G04", sceneId) : undefined}
                onMouseEnter={interactive && interactionKey ? () => setHoveredAudienceStage(interactionKey) : undefined}
                onMouseLeave={interactive ? () => setHoveredAudienceStage(null) : undefined}
                onFocus={interactive && interactionKey ? () => setHoveredAudienceStage(interactionKey) : undefined}
                onBlur={interactive ? () => setHoveredAudienceStage(null) : undefined}
              />,
            ];
          }

          return PET_GROUP_IDS.map((groupId, rowIndex) => {
            const record = recordFor(sceneId, groupId);
            return (
              <DataCard
                key={`${field}-${sceneId}-${groupId}`}
                content={record?.[field]}
                provider={provider}
                layoutStyle={{ gridColumn, gridRow: rowIndex + 1 }}
                interactive={interactive}
                showArrow={interactive}
                ariaLabel={interactive ? audienceStageAriaLabel(groupId, sceneId) : undefined}
                onClick={interactive ? () => openAudienceStageFor(groupId, sceneId) : undefined}
                onMouseEnter={interactive && interactionKey ? () => setHoveredAudienceStage(interactionKey) : undefined}
                onMouseLeave={interactive ? () => setHoveredAudienceStage(null) : undefined}
                onFocus={interactive && interactionKey ? () => setHoveredAudienceStage(interactionKey) : undefined}
                onBlur={interactive ? () => setHoveredAudienceStage(null) : undefined}
              />
            );
          });
        })}
      </div>
    );
  }

  const activeScene = scenes.find((scene) => scene["場景ID"] === openScene);
  const openIndex = openScene ? sceneIds.indexOf(openScene) : -1;
  const activeAudienceSource = openAudienceStage
    ? AUDIENCE_SOURCES.find((audience) => audience.id === openAudienceStage.audienceId)
    : null;
  const activeAudienceStage = activeAudienceSource && openAudienceStage
    ? activeAudienceSource.stages[openAudienceStage.stageKey]
    : null;

  return (
    <main data-source={dataSource}>
      <SitePageHeader
        page="flow"
        title="防災避難服務流程分析"
        description="從備災、緊急應變、避難到中長期復原等階段中的七個核心場景，查看不同族群及服務提供者需求。"
      />

      <section className="toolbar" aria-label="流程篩選">
        <div className="wrap toolbar-grid">
          <span className="toolbar-label">族群對象</span>
          <div className="button-row">
            {GROUPS.map((group) => {
              const selected = selectedGroups.has(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`filter-button ${selected ? "is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => toggleGroup(group.id)}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mobile-toolbar" aria-label="手機版流程篩選">
        <div className="mobile-filter-row">
          <span className="mobile-filter-label">族群</span>
          <div className="mobile-button-scroll">
            {GROUPS.map((group) => {
              const selected = selectedGroups.has(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`filter-button ${selected ? "is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => toggleGroup(group.id)}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </div>

      </section>

      <section className="journey-section">
        <HorizontalScroll className="journey-scroll" ariaLabel="防災避難服務流程，可左右捲動">
          <div className="journey-board">
            <div className="flow-row phase-row">
              <div className="row-label">階段</div>
              {PHASES.map((phase) => (
                <div
                  className="phase-cell"
                  key={phase.label}
                  style={{ gridColumn: `${phase.start} / span ${phase.span}` }}
                >
                  {phase.label}
                </div>
              ))}
            </div>

            <div className="flow-row time-row">
              <div className="row-label">時間</div>
              {TIMES.map((time) => (
                <div
                  className="meta-cell"
                  key={time.label}
                  style={{ gridColumn: `${time.start} / span ${time.span}` }}
                >
                  {time.label}
                </div>
              ))}
            </div>

            <FlowRow label="核心場景" className="scene-row">
              {scenes.map((scene) => {
                const [domain, name] = scene["核心場景"].split("｜");
                return (
                  <article
                    className="scene-heading-card"
                    key={scene["場景ID"]}
                  >
                    <span>{domain}</span>
                    <strong>{name}</strong>
                  </article>
                );
              })}
            </FlowRow>

            <FlowRow label="場景需求" className="needs-row section-start">
              {scenes.map((scene) => (
                <button
                  type="button"
                  className="need-card interactive-card"
                  key={scene["場景ID"]}
                  onClick={() => setOpenScene(scene["場景ID"])}
                  aria-label={`展開${scene["核心場景"]}完整場景需求`}
                >
                  <ul>
                    {compactNeed(scene["場景ID"], summaryFor(scene["場景ID"]), scene["場景通用需求（報告2-2原文）"]).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <span className="expand-corner" aria-hidden="true">↗</span>
                </button>
              ))}
            </FlowRow>

            {displayedGroupIds.length > 0 && (
              <div className="section-caption group-caption">不同族群需求</div>
            )}

            {standardGroupIds.map((groupId) => (
              <FlowRow label={GROUP_LABELS[groupId]} key={`need-${groupId}`} className="group-row">
                {stageOutlines(AUDIENCE_ID_BY_GROUP[groupId])}
                {scenes.map((scene, sceneIndex) => {
                  const record = recordFor(scene["場景ID"], groupId);
                  const content = record?.["族群需求"];
                  const interactionKey = audienceStageKey(groupId, scene["場景ID"]);
                  return (
                    <DataCard
                      key={`${scene["場景ID"]}-${groupId}`}
                      content={content}
                      layoutStyle={{ gridColumn: sceneIndex + 2, gridRow: 1 }}
                      interactive
                      showArrow
                      ariaLabel={audienceStageAriaLabel(groupId, scene["場景ID"])}
                      onClick={() => openAudienceStageFor(groupId, scene["場景ID"])}
                      onMouseEnter={interactionKey ? () => setHoveredAudienceStage(interactionKey) : undefined}
                      onMouseLeave={() => setHoveredAudienceStage(null)}
                      onFocus={interactionKey ? () => setHoveredAudienceStage(interactionKey) : undefined}
                      onBlur={() => setHoveredAudienceStage(null)}
                    />
                  );
                })}
              </FlowRow>
            ))}

            {showPetSpeciesRows && renderPetRows("族群需求")}

            {displayedGroupIds.length > 0 && (
              <div className="section-caption provider-caption">服務提供者需求</div>
            )}

            <FlowRow
              label="主要服務提供者"
              className={`provider-row ${displayedGroupIds.length > 0 ? "section-start" : "provider-row-compact"}`}
            >
              {scenes.map((scene) => (
                <div
                  className="provider-card"
                  key={scene["場景ID"]}
                >
                  <strong>{scene["主要服務提供者"]}</strong>
                  <span>{scene["服務內容"]}</span>
                </div>
              ))}
            </FlowRow>

            <FlowRow label="需求痛點" className="provider-row pain-row">
              {scenes.map((scene) => (
                <div
                  className="provider-card pain-card"
                  key={scene["場景ID"]}
                >
                  <ul>
                    {splitLines(scene["服務端共通痛點"]).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </FlowRow>

            {standardGroupIds.map((groupId) => (
              <FlowRow
                label={`${GROUP_LABELS[groupId]}因應策略`}
                key={`provider-${groupId}`}
                className="provider-group-row"
              >
                {scenes.map((scene) => {
                  const record = recordFor(scene["場景ID"], groupId);
                  return (
                    <DataCard
                      key={`${scene["場景ID"]}-provider-${groupId}`}
                      content={record?.["服務端挑戰／考量重點（AI草稿）"]}
                      provider
                    />
                  );
                })}
              </FlowRow>
            ))}

            {showPetSpeciesRows && renderPetRows("服務端挑戰／考量重點（AI草稿）", true)}
          </div>
        </HorizontalScroll>
      </section>

      <footer className="wrap footer">
        <p>選擇族群展開需求　｜　再按一次取消　｜　點選需求卡查看完整內容　｜　Esc 關閉詳情</p>
        <div>
          <span className="footer-team">打包一個家：未來生活的防災避難創新設計</span>
        </div>
      </footer>

      {activeScene && openScene && (
        <div className="modal-veil" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpenScene(null);
        }}>
          <article className="scene-modal" role="dialog" aria-modal="true" aria-labelledby="scene-modal-title">
            <div className="modal-topline">
              <span>{activeScene["階段"]}　{activeScene["時間"]}</span>
              <button type="button" onClick={() => setOpenScene(null)} aria-label="關閉場景詳情">×</button>
            </div>
            <div className="modal-heading">
              <p>{activeScene["核心場景"].split("｜")[0]}</p>
              <h2 id="scene-modal-title">{activeScene["核心場景"].split("｜")[1]}</h2>
            </div>
            <section className="modal-section">
              <h3>場景需求</h3>
              <ul>
                {splitLines(activeScene["場景通用需求（報告2-2原文）"]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section className="modal-section what-if-section">
              <h3>設計 WHAT IF</h3>
              <div>
                {(sceneDetail[openScene as keyof typeof sceneDetail]?.whatIf ?? []).map((item) => (
                  <p key={item}><strong>What if</strong>{item.replace(/^What if\s*/, "")}</p>
                ))}
              </div>
            </section>
            <div className="modal-nav">
              <button type="button" onClick={() => setOpenScene(sceneIds[(openIndex - 1 + sceneIds.length) % sceneIds.length])}>← 上一個場景</button>
              <span>{openIndex + 1} / {sceneIds.length}</span>
              <button type="button" onClick={() => setOpenScene(sceneIds[(openIndex + 1) % sceneIds.length])}>下一個場景 →</button>
            </div>
          </article>
        </div>
      )}

      {activeAudienceSource && activeAudienceStage && openAudienceStage && (
        <div className="modal-veil" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpenAudienceStage(null);
        }}>
          <article
            className="scene-modal audience-stage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audience-stage-modal-title"
            style={{ "--audience-accent": activeAudienceSource.accent } as React.CSSProperties}
          >
            <div className="modal-topline audience-stage-topline">
              <div>
                <span>{activeAudienceSource.label}</span>
                <span>{activeAudienceStage.time}</span>
              </div>
              <button type="button" onClick={() => setOpenAudienceStage(null)} aria-label="關閉族群詳細情境">×</button>
            </div>
            <div className="modal-heading audience-stage-heading">
              <h2 id="audience-stage-modal-title">{activeAudienceStage.no}　{activeAudienceStage.name}</h2>
              <p>{activeAudienceStage.focus}</p>
            </div>
            {activeAudienceStage.illustration && (
              <div className="audience-stage-illustration">
                <img
                  src={activeAudienceStage.illustration}
                  alt={`${activeAudienceSource.label} - ${activeAudienceStage.name}情境示意圖`}
                />
              </div>
            )}
            <section className="modal-section audience-stage-content">
              <p className="audience-stage-summary">{activeAudienceStage.summary}</p>
              <ul>
                {activeAudienceStage.details.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            {activeAudienceStage.example && (
              <section className="audience-stage-example">
                <p>{activeAudienceStage.example}</p>
                {activeAudienceStage.exampleImages.length > 0 && (
                  <div className={`audience-stage-example-images ${activeAudienceStage.exampleImages.length === 1 ? "is-single" : ""}`}>
                    {activeAudienceStage.exampleImages.map((image, index) => (
                      <img
                        src={image}
                        alt={`${activeAudienceSource.label} - ${activeAudienceStage.name}補充案例圖 ${index + 1}`}
                        key={image}
                      />
                    ))}
                  </div>
                )}
                {activeAudienceStage.sources.length > 0 && (
                  <div className="audience-stage-sources">
                    {activeAudienceStage.sources.map((source) => (
                      <a href={source.url} target="_blank" rel="noreferrer" key={`${source.label}-${source.url}`}>
                        {source.label}<span aria-hidden="true"> ↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}
          </article>
        </div>
      )}

    </main>
  );
}

function FlowRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flow-row ${className}`}>
      <div className="row-label">{label}</div>
      {children}
    </div>
  );
}

function DataCard({
  content,
  muted = false,
  related = false,
  provider = false,
  className = "",
  layoutStyle,
  interactive = false,
  showArrow = false,
  ariaLabel,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
}: {
  content?: string;
  muted?: boolean;
  related?: boolean;
  provider?: boolean;
  className?: string;
  layoutStyle?: React.CSSProperties;
  interactive?: boolean;
  showArrow?: boolean;
  ariaLabel?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
}) {
  const style = {
    ...layoutStyle,
  } as React.CSSProperties;
  const classes = `data-card ${provider ? "provider-data-card" : ""} ${interactive ? "audience-detail-card" : ""} ${className} ${related ? "is-related" : ""} ${muted ? "is-muted" : ""} ${!content ? "is-empty" : ""}`;
  if (interactive) {
    return (
      <button
        type="button"
        className={classes}
        style={style}
        aria-label={ariaLabel}
        disabled={muted}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {content && (
          <ul>
            {splitLines(content).map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
        {showArrow && <span className="expand-corner" aria-hidden="true">↗</span>}
      </button>
    );
  }
  if (!content) {
    return (
      <div
        className={`data-card is-empty ${className} ${muted ? "is-muted" : ""}`}
        style={style}
        aria-hidden="true"
      />
    );
  }
  return (
    <article
      className={classes}
      style={style}
    >
      <ul>
        {splitLines(content).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}

export default function Home() {
  const [hashRoute, setHashRoute] = useState("");

  useEffect(() => {
    function syncRoute() {
      setHashRoute(window.location.hash);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  if (hashRoute.startsWith("#/scenarios")) {
    const scenarioId = hashRoute.split("/")[2] || null;
    return (
      <ScenarioExperience
        scenarioId={scenarioId}
        onSelect={(id) => { window.location.hash = id ? `#/scenarios/${id}` : "#/scenarios"; }}
        onBack={() => { window.location.hash = ""; }}
      />
    );
  }

  return <MainContent />;
}
