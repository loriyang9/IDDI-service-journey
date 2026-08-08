"use client";

import { useEffect, useMemo, useState } from "react";
import fallbackData from "./data/sheet-fallback.json";
import mediaFallback from "./data/media-fallback.json";
import sceneDetail from "./data/scene-detail.json";

type Cell = string | number | boolean | null | undefined;
type SheetBlock = { range?: string; values: Cell[][] };
type SheetBundle = {
  main: SheetBlock;
  scenarios: SheetBlock;
  media?: SheetBlock;
};

type MainRecord = Record<string, string>;
type ScenarioRecord = Record<string, string>;
type MediaRecord = Record<string, string>;
type CaseMedia = {
  src: string;
  alt: string;
  kind?: "image" | "drive-video";
};

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1GIYgRjDdqRQ7qh9YaT6hT_gtPSgiLsR11C0RngMyGg4/edit";
const REPORT_URL =
  "https://docs.google.com/document/d/1TyENXPJIeK8O9Wt1Me9GLUVq78ISxm8qvqvCOm0FqsA/edit";
const TECH_URL = "https://fudy-paper-structure.vercel.app/";
const PET_STATUS = "寵物防災避難現況";

const CASE_MEDIA: Record<string, CaseMedia[]> = {
  M01: [
    {
      src: "https://drive.google.com/file/d/1X7EN7llh71Zmif8lMyJ_yRKBo-KbD602/preview",
      alt: "台灣防災演練寵物收容區現況第一段影片",
      kind: "drive-video",
    },
    {
      src: "https://drive.google.com/file/d/1-cQKmL4GdTyooioB-sdDi5PYqho3V6YW/preview",
      alt: "台灣防災演練寵物收容區現況第二段影片",
      kind: "drive-video",
    },
  ],
  M03: [
    {
      src: "cases/m03-japan-rescue-pet-support.webp",
      alt: "日本レスキュー協会災害救助犬與受災寵物支援標誌",
    },
  ],
  M04: [
    {
      src: "cases/m04-suizenji-pet-shelter.webp",
      alt: "動物支援ナース發布的熊本市水前寺競技場寵物同伴避難所社群貼文",
    },
    {
      src: "cases/m04b-kumamoto-pet-shelter-news.webp",
      alt: "熊本地震後人與寵物共同避難的新聞畫面",
    },
    {
      src: "cases/m04c-kyushu-animal-school.webp",
      alt: "九州動物學院寵物同行避難所內的飼主與寵物",
    },
    {
      src: "cases/m04d-disaster-veterinary-support.webp",
      alt: "災後動物醫療支援現場",
    },
  ],
};

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

const SCENARIO_COLORS: Record<string, string> = {
  K01: "#6B5B3E",
  K02: "#3D6B8F",
  K03: "#4D5560",
  K04: "#A8631A",
};

const SCENARIO_WASHES: Record<string, string> = {
  K01: "#EEE7DB",
  K02: "#E8EFF4",
  K03: "#ECEDEF",
  K04: "#F3E8DB",
};

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

function challengeParts(value: string) {
  const cleaned = value.replace(/^\d+[.、]\s*/, "").trim();
  const separator = cleaned.indexOf("：");
  return {
    title: separator >= 0 ? cleaned.slice(0, separator).trim() : cleaned,
    description: separator >= 0 ? cleaned.slice(separator + 1).trim() : "",
  };
}

function normalizeChallenge(value: string) {
  return challengeParts(value).title;
}

function matchesChallenge(mapping: string, challenge: string) {
  const target = normalizeChallenge(challenge);
  return mapping
    .split(/[／/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .some((item) => item === target || item.includes(target) || target.includes(item));
}

function normalizeMediaUrl(value: string) {
  const driveFileId = value.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1];
  if (driveFileId) {
    return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1600`;
  }
  return value.startsWith("/") ? value.slice(1) : value;
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

function scenarioMembers(records: MainRecord[], scenarioId: string) {
  const members = new Set(
    records
      .filter((record) => record["關鍵情境ID"] === scenarioId)
      .map((record) => record["族群ID"])
  );
  if (scenarioId === "K04" && members.has("G04")) {
    members.add("G05");
    members.add("G06");
  }
  return members;
}

function MainContent() {
  const [bundle, setBundle] = useState<SheetBundle>(fallbackData as SheetBundle);
  const [dataSource, setDataSource] = useState<"fallback" | "live">("fallback");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<string | null>(null);
  const [openScene, setOpenScene] = useState<string | null>(null);

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
        if (data?.main?.values?.length && data?.scenarios?.values?.length) {
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
  const scenarios = useMemo(
    () => rowsToObjects(bundle.scenarios.values) as ScenarioRecord[],
    [bundle]
  );
  const mediaRecords = useMemo(
    () => {
      const source = bundle.media?.values?.length
        ? (rowsToObjects(bundle.media.values) as MediaRecord[])
        : (mediaFallback as MediaRecord[]);
      return source.filter(
        (record) => !record["審核狀態"] || record["審核狀態"] === "已確認"
      );
    },
    [bundle]
  );

  useEffect(() => {
    setActiveChallenge(null);
  }, [activeScenario]);

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
        if (activeChallenge) setActiveChallenge(null);
        else if (openScene) setOpenScene(null);
      }
      if (!activeChallenge && openScene && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        const index = sceneIds.indexOf(openScene);
        const offset = event.key === "ArrowLeft" ? -1 : 1;
        setOpenScene(sceneIds[(index + offset + sceneIds.length) % sceneIds.length]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeChallenge, openScene, sceneIds]);

  useEffect(() => {
    if (!openScene && !activeChallenge) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeChallenge, openScene]);

  const contextMembers = activeScenario
    ? scenarioMembers(records, activeScenario)
    : new Set<string>();

  const visibleGroupIds = GROUPS.filter(
    (group) =>
      selectedGroups.has(group.id) ||
      group.members.some((member) => contextMembers.has(member))
  ).flatMap((group) => group.members);

  const displayedGroupIds =
    activeScenario === "K04" && visibleGroupIds.some((id) => PET_GROUP_IDS.includes(id))
      ? [...visibleGroupIds.filter((id) => !PET_GROUP_IDS.includes(id)), "PET_COMMON"]
      : visibleGroupIds;
  const showPetSpeciesRows = PET_GROUP_IDS.every((id) => displayedGroupIds.includes(id));
  const standardGroupIds = displayedGroupIds.filter((id) => !PET_GROUP_IDS.includes(id));

  const scenarioStyle = activeScenario
    ? ({
        "--scenario-color": SCENARIO_COLORS[activeScenario],
        "--scenario-wash": SCENARIO_WASHES[activeScenario],
      } as React.CSSProperties)
    : undefined;

  function toggleGroup(groupId: string) {
    setSelectedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function isSceneMuted(sceneId: string) {
    if (!activeScenario) return false;
    return !records.some(
      (record) =>
        record["場景ID"] === sceneId && record["關鍵情境ID"] === activeScenario
    );
  }

  function recordFor(sceneId: string, groupId: string) {
    if (groupId === "PET_COMMON") {
      return records.find(
        (record) =>
          record["場景ID"] === sceneId &&
          PET_GROUP_IDS.includes(record["族群ID"]) &&
          (!activeScenario || record["關鍵情境ID"] === activeScenario)
      );
    }
    return records.find(
      (record) => record["場景ID"] === sceneId && record["族群ID"] === groupId
    );
  }

  function isRecordMuted(record?: MainRecord) {
    if (!activeScenario) return false;
    return !record || record["關鍵情境ID"] !== activeScenario;
  }

  function isSceneRelated(sceneId: string) {
    return Boolean(activeScenario) && !isSceneMuted(sceneId);
  }

  function isRecordRelated(record?: MainRecord) {
    return Boolean(activeScenario && record?.["關鍵情境ID"] === activeScenario);
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

  function renderPetRows(field: string, provider = false) {
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

        {scenes.flatMap((scene, sceneIndex) => {
          const sceneId = scene["場景ID"];
          const gridColumn = sceneIndex + 2;
          if (petFieldIsShared(sceneId, field)) {
            const record = recordFor(sceneId, PET_GROUP_IDS[0]);
            return [
              <DataCard
                key={`${field}-${sceneId}-pet-common`}
                content={record?.[field]}
                muted={isRecordMuted(record)}
                related={isRecordRelated(record)}
                scenarioColor={activeScenario ? SCENARIO_COLORS[activeScenario] : undefined}
                provider={provider}
                className="pet-shared-card"
                layoutStyle={{ gridColumn, gridRow: "1 / span 3" }}
              />,
            ];
          }

          return PET_GROUP_IDS.map((groupId, rowIndex) => {
            const record = recordFor(sceneId, groupId);
            return (
              <DataCard
                key={`${field}-${sceneId}-${groupId}`}
                content={record?.[field]}
                muted={isRecordMuted(record)}
                related={isRecordRelated(record)}
                scenarioColor={activeScenario ? SCENARIO_COLORS[activeScenario] : undefined}
                provider={provider}
                layoutStyle={{ gridColumn, gridRow: rowIndex + 1 }}
              />
            );
          });
        })}
      </div>
    );
  }

  const activeScenarioData = scenarios.find(
    (scenario) => scenario["情境ID"] === activeScenario
  );
  const challengeItems = activeScenarioData
    ? splitLines(activeScenarioData["設計挑戰"]).map(challengeParts)
    : [];
  const activeChallengeSheetDetail = mediaRecords.find(
    (record) =>
      record["關鍵情境ID（內部）"] === activeScenario &&
      record["內容層級"] === "設計挑戰詳情" &&
      matchesChallenge(record["對應設計挑戰"] ?? "", activeChallenge ?? "")
  );
  const petStatusSelected = activeScenario === "K01" && activeChallenge === PET_STATUS;
  const activeChallengeDescription = petStatusSelected
    ? "以台灣防災演練中的寵物收容區現況為背景，觀察分區、動線、物資、籠具、照護及人寵共處等現場條件。"
    : challengeItems.find((item) => item.title === activeChallenge)?.description ||
      activeChallengeSheetDetail?.["一句說明（網站草稿）"] ||
      "";
  const activeCases = activeChallenge
    ? mediaRecords.filter(
        (record) => {
          if (record["關鍵情境ID（內部）"] !== activeScenario) return false;
          if (petStatusSelected) {
            return (
              record["內容層級"] === "情境現場" &&
              matchesChallenge(record["對應設計挑戰"] ?? "", PET_STATUS)
            );
          }
          return (
            ["情境現場", "參考案例"].includes(record["內容層級"]) &&
            matchesChallenge(record["對應設計挑戰"] ?? "", activeChallenge)
          );
        }
      )
    : [];
  const activeScene = scenes.find((scene) => scene["場景ID"] === openScene);
  const openIndex = openScene ? sceneIds.indexOf(openScene) : -1;

  return (
    <main data-source={dataSource}>
      <header className="pagehead wrap">
        <p className="eyebrow">打包一個家：未來生活的防災避難創新設計</p>
        <h1>防災避難服務流程分析</h1>
        <p className="lede">
          從備災、緊急應變、避難到中長期復原等階段中的七個核心場景，查看不同族群及服務提供者需求，以及關鍵應用情境的設計挑戰與技術解題重點。
        </p>
        <nav className="source-links" aria-label="相關資料">
          <span className="source-label">延伸閱讀</span>
          <a href={REPORT_URL} target="_blank" rel="noreferrer">未來防災避難關鍵情境研究報告 ↗</a>
          <a href={TECH_URL} target="_blank" rel="noreferrer">永續材料／結構研究報告 ↗</a>
        </nav>
      </header>

      <section className="toolbar" aria-label="流程篩選">
        <div className="wrap toolbar-grid">
          <span className="toolbar-label">族群對象</span>
          <div className="button-row">
            {GROUPS.map((group) => {
              const selected = selectedGroups.has(group.id);
              const contextual = group.members.some((member) => contextMembers.has(member));
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`filter-button ${selected ? "is-selected" : ""} ${
                    contextual && !selected ? "is-contextual" : ""
                  }`}
                  aria-pressed={selected}
                  onClick={() => toggleGroup(group.id)}
                  style={
                    activeScenario
                      ? ({ "--context-color": SCENARIO_COLORS[activeScenario] } as React.CSSProperties)
                      : undefined
                  }
                >
                  {group.label}
                </button>
              );
            })}
          </div>

          <span className="toolbar-label">關鍵情境</span>
          <div className="button-row scenario-row">
            {scenarios.map((scenario) => {
              const id = scenario["情境ID"];
              const active = id === activeScenario;
              return (
                <button
                  key={id}
                  type="button"
                  className={`scenario-button ${active ? "is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setActiveScenario(active ? null : id)}
                  style={({ "--scenario-color": SCENARIO_COLORS[id] } as React.CSSProperties)}
                >
                  <span
                    className="scenario-marker"
                    style={{ backgroundColor: SCENARIO_COLORS[id] }}
                    aria-hidden="true"
                  />
                  {scenario["情境名稱"]}
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
              const contextual = group.members.some((member) => contextMembers.has(member));
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`filter-button ${selected ? "is-selected" : ""} ${
                    contextual && !selected ? "is-contextual" : ""
                  }`}
                  aria-pressed={selected}
                  onClick={() => toggleGroup(group.id)}
                  style={
                    activeScenario
                      ? ({ "--context-color": SCENARIO_COLORS[activeScenario] } as React.CSSProperties)
                      : undefined
                  }
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mobile-filter-row">
          <span className="mobile-filter-label">情境</span>
          <div className="mobile-button-scroll">
            {scenarios.map((scenario) => (
              <button
                key={scenario["情境ID"]}
                type="button"
                className={`scenario-button ${scenario["情境ID"] === activeScenario ? "is-active" : ""}`}
                aria-pressed={scenario["情境ID"] === activeScenario}
                onClick={() => setActiveScenario(
                  scenario["情境ID"] === activeScenario ? null : scenario["情境ID"]
                )}
                style={({ "--scenario-color": SCENARIO_COLORS[scenario["情境ID"]] } as React.CSSProperties)}
              >
                <span
                  className="scenario-marker"
                  style={{ backgroundColor: SCENARIO_COLORS[scenario["情境ID"]] }}
                  aria-hidden="true"
                />
                {scenario["情境名稱"]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeScenarioData && activeScenario && (
        <section className="scenario-strip" aria-live="polite" style={scenarioStyle}>
          <div className="wrap scenario-strip-inner">
            <div className="scenario-heading">
              <h2>{activeScenarioData["情境名稱"]}</h2>
            </div>
            <div className="scenario-columns">
              <section>
                {activeScenario === "K01" && (
                  <div className="scenario-context-control">
                    <h3>背景與現況</h3>
                    <ol>
                      <li>
                        <button
                          type="button"
                          className={`challenge-button ${petStatusSelected ? "is-selected" : ""}`}
                          aria-expanded={petStatusSelected}
                          onClick={() => setActiveChallenge(petStatusSelected ? null : PET_STATUS)}
                        >
                          <span>{PET_STATUS}</span>
                          <span aria-hidden="true">{petStatusSelected ? "−" : "＋"}</span>
                        </button>
                      </li>
                    </ol>
                  </div>
                )}
                <h3>設計挑戰</h3>
                <ol>
                  {challengeItems.map((item) => {
                    const challenge = item.title;
                    const selected = activeChallenge === challenge;
                    return (
                    <li key={item.title}>
                      <button
                        type="button"
                        className={`challenge-button ${selected ? "is-selected" : ""}`}
                        aria-expanded={selected}
                        onClick={() => setActiveChallenge(selected ? null : challenge)}
                      >
                        <span>{challenge}</span>
                        <span aria-hidden="true">{selected ? "−" : "＋"}</span>
                      </button>
                    </li>
                    );
                  })}
                </ol>
              </section>
              <section>
                <h3>技術解題重點</h3>
                <ul>
                  {splitLines(activeScenarioData["技術解題重點"]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </section>
      )}

      <section className="journey-section">
        <div className="journey-scroll" tabIndex={0} aria-label="防災避難服務流程，可左右捲動">
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
                    className={`scene-heading-card ${isSceneRelated(scene["場景ID"]) ? "is-related" : ""} ${isSceneMuted(scene["場景ID"]) ? "is-muted" : ""}`}
                    key={scene["場景ID"]}
                    style={scenarioStyle}
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
                  className={`need-card interactive-card ${isSceneRelated(scene["場景ID"]) ? "is-related" : ""} ${isSceneMuted(scene["場景ID"]) ? "is-muted" : ""}`}
                  key={scene["場景ID"]}
                  onClick={() => setOpenScene(scene["場景ID"])}
                  aria-label={`展開${scene["核心場景"]}完整場景需求`}
                  style={scenarioStyle}
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
                {scenes.map((scene) => {
                  const record = recordFor(scene["場景ID"], groupId);
                  const content = record?.["族群需求"];
                  return (
                    <DataCard
                      key={`${scene["場景ID"]}-${groupId}`}
                      content={content}
                      muted={isRecordMuted(record)}
                      related={isRecordRelated(record)}
                      scenarioColor={activeScenario ? SCENARIO_COLORS[activeScenario] : undefined}
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
                  className={`provider-card ${isSceneRelated(scene["場景ID"]) ? "is-related" : ""} ${isSceneMuted(scene["場景ID"]) ? "is-muted" : ""}`}
                  key={scene["場景ID"]}
                  style={scenarioStyle}
                >
                  <strong>{scene["主要服務提供者"]}</strong>
                  <span>{scene["服務內容"]}</span>
                </div>
              ))}
            </FlowRow>

            <FlowRow label="需求痛點" className="provider-row pain-row">
              {scenes.map((scene) => (
                <div
                  className={`provider-card pain-card ${isSceneRelated(scene["場景ID"]) ? "is-related" : ""} ${isSceneMuted(scene["場景ID"]) ? "is-muted" : ""}`}
                  key={scene["場景ID"]}
                  style={scenarioStyle}
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
                      muted={isRecordMuted(record)}
                      related={isRecordRelated(record)}
                      scenarioColor={activeScenario ? SCENARIO_COLORS[activeScenario] : undefined}
                      provider
                    />
                  );
                })}
              </FlowRow>
            ))}

            {showPetSpeciesRows && renderPetRows("服務端挑戰／考量重點（AI草稿）", true)}
          </div>
        </div>
      </section>

      <footer className="wrap footer">
        <p>選擇族群展開需求　｜　選擇關鍵情境聚焦對應內容　｜　再按一次取消　｜　Esc 關閉詳情</p>
        <div>
          <span className="footer-team">打包一個家：未來生活的防災避難創新設計</span>
          <a href={SHEET_URL} target="_blank" rel="noreferrer">資料來源 ↗</a>
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

      {activeChallenge && activeScenarioData && (
        <div className="modal-veil case-modal-veil" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setActiveChallenge(null);
        }}>
          <article
            className="case-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-modal-title"
            style={scenarioStyle}
          >
            <div className="case-modal-topline">
              <div>
                <span>{activeScenarioData["情境名稱"]}</span>
                <span>{petStatusSelected ? "背景與現況" : "設計挑戰"}</span>
              </div>
              <button type="button" onClick={() => setActiveChallenge(null)} aria-label="關閉現場與案例">×</button>
            </div>
            <div className="case-modal-content">
              <div className="case-panel-heading">
                <div>
                  <p>{petStatusSelected ? "現況觀察" : "現場與案例"}</p>
                  <h2 id="case-modal-title">{activeChallenge}</h2>
                </div>
              </div>
              {activeChallengeDescription && (
                <p className="challenge-summary">{activeChallengeDescription}</p>
              )}
              {activeCases.length > 0 ? (
                <div className="case-grid">
                  {activeCases.map((record) => (
                    <article className="case-card" key={record["素材ID"]}>
                      <CaseMediaGallery record={record} />
                      <div className="case-card-body">
                        <div className="case-meta">
                          <span>{petStatusSelected ? "現況案例" : record["內容層級"]}</span>
                        </div>
                        <h3>{record["卡片標題"]}</h3>
                        <p>{record["一句說明（網站草稿）"]}</p>
                        {record["與設計挑戰的關聯"] && (
                          <p className="case-relation">{record["與設計挑戰的關聯"]}</p>
                        )}
                        {record["來源標示（網站）"] && (
                          <p className="case-source">來源：{record["來源標示（網站）"]}</p>
                        )}
                        {record["外部來源URL"] && (
                          <a href={record["外部來源URL"]} target="_blank" rel="noreferrer">查看原始來源 ↗</a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="case-empty">目前沒有可對應這項挑戰的案例卡。</p>
              )}
            </div>
          </article>
        </div>
      )}

    </main>
  );
}

function CaseMediaGallery({ record }: { record: MediaRecord }) {
  const [index, setIndex] = useState(0);
  const media = CASE_MEDIA[record["素材ID"]] ?? (
    record["媒體URL"]
      ? [{ src: normalizeMediaUrl(record["媒體URL"]), alt: record["卡片標題"] }]
      : []
  );
  if (!media.length) return null;
  const current = media[index] ?? media[0];

  return (
    <div className="case-media-gallery">
      <figure>
        {current.kind === "drive-video" ? (
          <iframe
            src={current.src}
            title={current.alt}
            loading="lazy"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        ) : (
          <img src={current.src} alt={current.alt} loading="lazy" />
        )}
      </figure>
      {media.length > 1 && (
        <div className="case-media-nav" aria-label={`${record["卡片標題"]}圖片切換`}>
          <button
            type="button"
            onClick={() => setIndex((index - 1 + media.length) % media.length)}
            aria-label="上一張圖片"
          >
            ←
          </button>
          <span>{index + 1} / {media.length}</span>
          <button
            type="button"
            onClick={() => setIndex((index + 1) % media.length)}
            aria-label="下一張圖片"
          >
            →
          </button>
        </div>
      )}
    </div>
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
  muted,
  related,
  scenarioColor,
  provider = false,
  className = "",
  layoutStyle,
}: {
  content?: string;
  muted: boolean;
  related: boolean;
  scenarioColor?: string;
  provider?: boolean;
  className?: string;
  layoutStyle?: React.CSSProperties;
}) {
  const style = {
    ...(scenarioColor ? { "--scenario-color": scenarioColor } : {}),
    ...layoutStyle,
  } as React.CSSProperties;
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
      className={`data-card ${provider ? "provider-data-card" : ""} ${className} ${related ? "is-related" : ""} ${muted ? "is-muted" : ""}`}
      style={style}
    >
      <ul>
        {splitLines(content).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}

export default function Home() {
  return <MainContent />;
}
