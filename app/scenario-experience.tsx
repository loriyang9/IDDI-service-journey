"use client";

import { useEffect, useMemo, useState } from "react";
import fallbackData from "./data/sheet-fallback.json";
import mediaFallback from "./data/media-fallback.json";
import SitePageHeader, { SiteNavigation } from "./site-page-header";
import HorizontalScroll from "./horizontal-scroll";

type Cell = string | number | boolean | null | undefined;
type SheetBlock = { range?: string; values: Cell[][] };
type SheetBundle = { main: SheetBlock; scenarios: SheetBlock; media?: SheetBlock };
type RecordRow = Record<string, string>;
type CaseMedia = { src: string; alt: string; kind: "image" | "video" };

const SCENARIO_COLORS: Record<string, string> = {
  K01: "#6b5b3e",
  K02: "#3d6b8f",
  K03: "#555c65",
  K04: "#ad6518",
};

const SCENARIO_WASHES: Record<string, string> = {
  K01: "#eee8dd",
  K02: "#e7eef3",
  K03: "#ebecef",
  K04: "#f3e7da",
};

const SCENARIO_IMAGES: Record<string, string> = {
  K01: "scenarios/k01-furniture-kit.svg",
  K02: "scenarios/k02-sleep.svg",
  K03: "scenarios/k03-toilet.svg",
  K04: "scenarios/k04-logistics.svg",
};

const GROUP_LABELS: Record<string, string> = {
  G01: "高齡者",
  G02: "多元文化者",
  G03: "親子家庭",
  G04: "中小型犬家庭",
  G05: "貓家庭",
  G06: "特寵家庭",
};

const LIFECYCLE_FIELDS = [
  ["備災期", "備災期設計挑戰"],
  ["緊急應變期", "緊急應變期設計挑戰"],
  ["緊急避難期", "緊急避難期設計挑戰"],
  ["中長期收容與復原期", "中長期收容與復原期設計挑戰"],
] as const;

const OVERVIEW_PHASES = [
  { label: "備災期", start: 2, span: 2 },
  { label: "緊急應變期", start: 4, span: 3 },
  { label: "緊急避難期", start: 7, span: 1 },
  { label: "中長期收容與復原期", start: 8, span: 1 },
];

const SCENARIO_TITLE_LINES: Record<string, string[]> = {
  K01: ["寵物家庭的避難與安置：", "避難所、車宿或帳棚"],
  K02: ["高齡者舒適與安全的", "睡眠環境"],
  K03: ["不同族群安全與舒適的", "如廁工具"],
  K04: ["災時海量物資的", "敏捷分類與配給系統"],
};

const SCENE_NAME_LINES: Record<string, string[]> = {
  C01: ["物資儲備", "空間收納"],
  C02: ["教育推行", "減災演練"],
  C03: ["多元儲備", "配給發放"],
  C04: ["舒適睡眠", "彈性屏障"],
  C05: ["應急衛廁", "環境維護"],
  C06: ["社群連結", "心理撫慰"],
  C07: ["物資循環", "中繼安置"],
};

const RELATION_LABEL_LINES: Record<string, string[]> = {
  K01: ["寵物家庭需求", "中小型犬／貓／特寵"],
  K02: ["高齡者需求"],
  K03: ["高齡者／親子家庭", "多元文化者需求"],
  K04: ["各族群", "特殊物資需求"],
};

const BUNDLED_MEDIA: Record<string, CaseMedia[]> = {
  M01: [
    {
      src: "https://drive.google.com/file/d/1X7EN7llh71Zmif8lMyJ_yRKBo-KbD602/preview",
      alt: "台灣防災演練寵物收容區現況第一段影片",
      kind: "video",
    },
    {
      src: "https://drive.google.com/file/d/1-cQKmL4GdTyooioB-sdDi5PYqho3V6YW/preview",
      alt: "台灣防災演練寵物收容區現況第二段影片",
      kind: "video",
    },
  ],
  M22: [
    {
      src: "https://drive.google.com/file/d/18ge4336t42nMNN_vuIW-WwE6R8LGeGXo/preview",
      alt: "物資領取、分類與入住分派現場第一段影片",
      kind: "video",
    },
    {
      src: "https://drive.google.com/file/d/1G6S6PjmMIyAW-HYasyLMGSWrTtPojWY4/preview",
      alt: "物資分派動線、人員協作與物資陳列現場第二段影片",
      kind: "video",
    },
  ],
  M18: [
    {
      src: "https://www.youtube-nocookie.com/embed/nXvwt1GKw5Q?start=59&rel=0",
      alt: "停水後仰賴簡易廁所的避難現場報導",
      kind: "video",
    },
  ],
};

function rowsToObjects(values: Cell[][]): RecordRow[] {
  const [header = [], ...rows] = values;
  const keys = header.map((cell) => String(cell ?? ""));
  return rows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row) => Object.fromEntries(keys.map((key, index) => [key, String(row[index] ?? "")])));
}

function splitLines(value = "") {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•*-]\s*/, "").trim())
    .filter(Boolean);
}

function caseMedia(record: RecordRow): CaseMedia[] {
  const bundled = BUNDLED_MEDIA[record["素材ID"]];
  if (bundled) return bundled;
  const url = record["媒體URL"] ?? "";
  if (!url || url.includes("docs.google.com/presentation")) return [];
  const driveId = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1];
  if (driveId) {
    const isVideo = record["素材類型"].includes("影片") || record["建議呈現"].includes("影片");
    return [{
      src: isVideo
        ? `https://drive.google.com/file/d/${driveId}/preview`
        : `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`,
      alt: record["卡片標題"],
      kind: isVideo ? "video" : "image",
    }];
  }
  return [{ src: url.startsWith("/") ? url.slice(1) : url, alt: record["卡片標題"], kind: "image" }];
}

function ScenarioCaseCard({ record }: { record: RecordRow }) {
  const media = caseMedia(record);
  const [index, setIndex] = useState(0);
  const current = media[index] ?? media[0];
  const typeLabel = record["內容層級"] === "情境現場" ? "現場觀察" : "案例啟發";

  return (
    <article className="v2-case-card">
      {current && (
        <div className="v2-case-media">
          {current.kind === "video" ? (
            <iframe
              src={current.src}
              title={current.alt}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
            />
          ) : (
            <img src={current.src} alt={current.alt} loading="lazy" />
          )}
          {media.length > 1 && (
            <div className="v2-case-media-nav" aria-label={`${record["卡片標題"]}媒體切換`}>
              <button type="button" onClick={() => setIndex((index - 1 + media.length) % media.length)} aria-label="上一項">←</button>
              <span>{index + 1} / {media.length}</span>
              <button type="button" onClick={() => setIndex((index + 1) % media.length)} aria-label="下一項">→</button>
            </div>
          )}
        </div>
      )}
      <div className="v2-case-body">
        <p className="v2-case-type">{typeLabel}</p>
        <h3>{record["卡片標題"]}</h3>
        <p>{record["一句說明（網站草稿）"]}</p>
        {record["來源標示（網站）"] && <p className="v2-case-source">來源：{record["來源標示（網站）"]}</p>}
        {record["外部來源URL"] && (
          <a href={record["外部來源URL"]} target="_blank" rel="noreferrer">查看原始來源 ↗</a>
        )}
      </div>
    </article>
  );
}

function TextLines({ value }: { value: string }) {
  const subheads = new Set(["狗狗", "貓", "特寵"]);
  return (
    <div className="v2-text-lines">
      {splitLines(value).map((line, index) => (
        line.endsWith("：") || subheads.has(line)
          ? <h4 key={`${line}-${index}`}>{line}</h4>
          : <p key={`${line}-${index}`}>{line}</p>
      ))}
    </div>
  );
}

type SpecGroup = { title: string; lines: string[] };

function parseSpecGroups(value: string): SpecGroup[] {
  const blocks = value.trim().split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const normalized = blocks.length === 1 && blocks[0].split(/\r?\n/).every((line) => /^\s*[•*-]/.test(line))
    ? blocks[0].split(/\r?\n/)
    : blocks;

  return normalized.map((block) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const first = lines.shift()?.replace(/^[•*-]\s*/, "") ?? "";
    if (/^[•*-]/.test(block) && first.includes("：")) {
      const colon = first.indexOf("：");
      return { title: first.slice(0, colon), lines: [first.slice(colon + 1).trim()] };
    }
    return { title: first, lines };
  });
}

function SpecContent({ lines }: { lines: string[] }) {
  const headingIndexes = lines
    .map((line, index) => (!/^[•*-]/.test(line) && (line.endsWith("：") || ["狗狗", "貓", "特寵"].includes(line)) ? index : -1))
    .filter((index) => index >= 0);
  if (headingIndexes.length >= 2) {
    const sections = headingIndexes.map((start, index) => ({
      label: lines[start].replace(/：$/, ""),
      lines: lines.slice(start + 1, headingIndexes[index + 1] ?? lines.length),
    }));
    return (
      <div className="v2-spec-subsections">
        {sections.map((section) => (
          <section key={section.label}>
            <h4>{section.label}</h4>
            <TextLines value={section.lines.join("\n")} />
          </section>
        ))}
      </div>
    );
  }
  return <TextLines value={lines.join("\n")} />;
}

function SpecAccordion({ value }: { value: string }) {
  const groups = useMemo(() => parseSpecGroups(value), [value]);
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));
  return (
    <div className="v2-spec-list">
      {groups.map((group, index) => {
        const expanded = open.has(index);
        return (
          <article className={`v2-spec-item ${expanded ? "is-open" : ""}`} key={`${group.title}-${index}`}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen((current) => {
                const next = new Set(current);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
              })}
            >
              <span>{group.title}</span>
              <b aria-hidden="true">{expanded ? "−" : "+"}</b>
            </button>
            {expanded && group.lines.length > 0 && (
              <div className="v2-spec-body"><SpecContent key={group.title} lines={group.lines} /></div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default function ScenarioExperience({
  scenarioId,
  onSelect,
  onBack,
}: {
  scenarioId: string | null;
  onSelect: (id: string | null) => void;
  onBack: () => void;
}) {
  const [bundle, setBundle] = useState<SheetBundle>(() => ({
    main: fallbackData.main,
    scenarios: fallbackData.scenarios,
  } as SheetBundle));
  const [media, setMedia] = useState<RecordRow[]>(mediaFallback as RecordRow[]);

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
          if (data.media?.values?.length) setMedia(rowsToObjects(data.media.values));
        }
      })
      .catch(() => {
        // The synced local fallback remains available when the sheet is offline.
      });
    return () => controller.abort();
  }, []);

  const mainRecords = useMemo(() => rowsToObjects(bundle.main.values), [bundle.main]);
  const overviewScenes = useMemo(() => {
    const seen = new Map<string, RecordRow>();
    mainRecords.forEach((record) => {
      if (record["場景ID"] && !seen.has(record["場景ID"])) seen.set(record["場景ID"], record);
    });
    return [...seen.values()].sort((a, b) => a["場景ID"].localeCompare(b["場景ID"]));
  }, [mainRecords]);
  const scenarios = useMemo(
    () => rowsToObjects(bundle.scenarios.values)
      .filter((record) => record["情境ID"] && record["新版審核狀態"] === "使用者確認")
      .sort((a, b) => Number(a["顯示排序"] || 99) - Number(b["顯示排序"] || 99)),
    [bundle.scenarios]
  );
  const active = scenarios.find((record) => record["情境ID"] === scenarioId) ?? null;
  const activeIndex = active ? scenarios.indexOf(active) : -1;

  useEffect(() => {
    const previous = document.title;
    document.title = active
      ? `${active["產品方向"]}｜關鍵應用情境`
      : "關鍵應用情境｜防災避難服務流程分析";
    return () => { document.title = previous; };
  }, [active]);

  function relationsFor(scenario: RecordRow) {
    const ids = scenario["對應主表紀錄ID"].split(/[、,]/).map((item) => item.trim()).filter(Boolean);
    const rows = ids
      .map((id) => mainRecords.find((record) => record["紀錄ID"] === id))
      .filter((record): record is RecordRow => Boolean(record));
    const first = rows[0];
    const needs: { label: string; need: string }[] = [];
    rows.forEach((row) => {
      const item = { label: GROUP_LABELS[row["族群ID"]] ?? row["族群"], need: row["族群需求"] };
      if (!needs.some((existing) => existing.label === item.label && existing.need === item.need)) needs.push(item);
    });
    const petRows = rows.filter((row) => ["G04", "G05", "G06"].includes(row["族群ID"]));
    if (petRows.length > 1 && petRows.every((row) => row["族群需求"] === petRows[0]["族群需求"])) {
      const petLabels = new Set(petRows.map((row) => GROUP_LABELS[row["族群ID"]]));
      const firstPetIndex = needs.findIndex((item) => petLabels.has(item.label));
      const withoutSpecies = needs.filter((item) => !petLabels.has(item.label));
      withoutSpecies.splice(Math.max(firstPetIndex, 0), 0, {
        label: "寵物家庭",
        need: petRows[0]["族群需求"],
      });
      needs.splice(0, needs.length, ...withoutSpecies);
    }
    return {
      phase: first?.["階段"] ?? "",
      time: first?.["時間"] ?? "",
      sceneId: first?.["場景ID"] ?? scenario["對應場景ID"],
      scene: first?.["核心場景"] ?? "",
      needs,
    };
  }

  if (!active) {
    return (
      <main className="scenario-v2-page">
        <SitePageHeader
          page="scenarios"
          title="關鍵應用情境"
          description="從突發災害時最關鍵的場景需求出發，針對富迪能夠透過核心紙構技術解決的問題進行分析。"
          onNavigateFlow={onBack}
        />

        <section className="v2-overview wrap" aria-labelledby="v2-overview-heading">
          <h2 className="sr-only" id="v2-overview-heading">關鍵應用情境與核心場景關係</h2>
          <HorizontalScroll className="v2-matrix-scroll" ariaLabel="關鍵應用情境與七個核心場景關係，可左右滑動">
            <div className="v2-relation-matrix">
              <div className="v2-matrix-guides" aria-hidden="true">
                {overviewScenes.map((scene) => <span key={`guide-${scene["場景ID"]}`} />)}
              </div>
              <div className="v2-matrix-phase-row">
                <div className="v2-matrix-corner">核心場景</div>
                {OVERVIEW_PHASES.map((phase) => (
                  <div
                    className="v2-matrix-phase"
                    key={phase.label}
                    style={{ gridColumn: `${phase.start} / span ${phase.span}` }}
                  >
                    {phase.label}
                  </div>
                ))}
              </div>
              <div className="v2-matrix-scene-row">
                <div className="v2-matrix-corner">關鍵應用情境</div>
                {overviewScenes.map((scene) => {
                  const [domain, name] = scene["核心場景"].split("｜");
                  return (
                    <div className="v2-matrix-scene" key={scene["場景ID"]}>
                      <span>{domain}</span>
                      <strong>
                        {(SCENE_NAME_LINES[scene["場景ID"]] ?? [name]).map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </strong>
                    </div>
                  );
                })}
              </div>
              {scenarios.map((scenario) => {
              const id = scenario["情境ID"];
              const relation = relationsFor(scenario);
              const sceneIndex = Math.max(
                overviewScenes.findIndex((scene) => scene["場景ID"] === relation.sceneId),
                0
              );
              const style = {
                "--v2-accent": SCENARIO_COLORS[id],
                "--v2-wash": SCENARIO_WASHES[id],
              } as React.CSSProperties;
              return (
                <div className="v2-matrix-data-row" style={style} key={id}>
                  <div className="v2-matrix-scenario-title">
                    <span className="v2-matrix-scenario-inner">
                      <span className="v2-matrix-scenario-copy">
                        {(SCENARIO_TITLE_LINES[id] ?? [scenario["情境名稱"]]).map((line) => (
                          <span className="v2-matrix-title-line" key={line}>{line}</span>
                        ))}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="v2-matrix-relation"
                    style={{ gridColumn: sceneIndex + 2 }}
                    onClick={() => onSelect(id)}
                    aria-label={`查看${scenario["情境名稱"]}完整內容`}
                  >
                    <span className="v2-relation-line" aria-hidden="true" />
                    <strong>
                      {(RELATION_LABEL_LINES[id] ?? []).map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </strong>
                    <span className="v2-relation-arrow" aria-hidden="true">↗</span>
                  </button>
                </div>
              );
            })}
            </div>
          </HorizontalScroll>
        </section>
        <footer className="wrap footer v2-footer"><span className="footer-team">打包一個家：未來生活的防災避難創新設計</span></footer>
      </main>
    );
  }

  const id = active["情境ID"];
  const style = {
    "--v2-accent": SCENARIO_COLORS[id],
    "--v2-wash": SCENARIO_WASHES[id],
  } as React.CSSProperties;
  const cases = media.filter((record) =>
    record["關鍵情境ID（內部）"] === id &&
    record["審核狀態"] === "已確認" &&
    ["情境現場", "參考案例"].includes(record["內容層級"]) &&
    !["M02", "M23"].includes(record["素材ID"]) &&
    Boolean(record["來源標示（網站）"]) &&
    caseMedia(record).length > 0
  );

  return (
    <main className="scenario-v2-page is-detail" style={style}>
      <header className="v2-detail-head wrap">
        <SiteNavigation page="scenarios" onNavigateFlow={onBack} onNavigateScenarios={() => onSelect(null)} />
        <div className="v2-detail-title">
          <span>{String(activeIndex + 1).padStart(2, "0")}</span>
          <div>
            <p>關鍵應用情境</p>
            <h1>{active["情境名稱"]}</h1>
          </div>
        </div>
      </header>

      <section className="v2-problem wrap v2-detail-section">
        <p className="v2-section-kicker">問題說明</p>
        <p>{active["問題說明"]}</p>
      </section>

      <section className="v2-cases-section v2-detail-section">
        <div className="wrap v2-section-heading">
          <div><p>現場觀察與案例啟發</p><h2>從真實情境理解問題</h2></div>
        </div>
        <HorizontalScroll className="v2-case-rail wrap" ariaLabel="現場觀察與案例啟發，可左右滑動">
          {cases.map((record) => <ScenarioCaseCard record={record} key={record["素材ID"]} />)}
        </HorizontalScroll>
      </section>

      <section className="v2-product-direction wrap v2-detail-section">
        <div>
          <p className="v2-section-kicker">產品方向</p>
          <h2>{active["產品方向"]}</h2>
          <p>{active["產品概念"]}</p>
        </div>
        <figure><img src={SCENARIO_IMAGES[id]} alt={`${active["產品方向"]}設計方向示意`} /></figure>
      </section>

      <section className="v2-spec-section wrap v2-detail-section">
        <div className="v2-section-heading"><div><p>核心功能與規格</p><h2>產品需要回應的設計條件</h2></div></div>
        <SpecAccordion key={id} value={active["核心功能與規格"]} />
      </section>

      <section className="v2-lifecycle-section v2-detail-section">
        <div className="wrap v2-section-heading">
          <div><p>產品全生命週期分析</p><h2>從平時儲備到災後回收</h2></div>
        </div>
        <HorizontalScroll className="v2-lifecycle-flow wrap" ariaLabel="產品全生命週期，可左右滑動">
          {LIFECYCLE_FIELDS.map(([label, field], index) => (
            <article key={field}>
              <div className="v2-lifecycle-top"><span>{String(index + 1).padStart(2, "0")}</span><h3>{label}</h3></div>
              <TextLines value={active[field]} />
              {index < LIFECYCLE_FIELDS.length - 1 && <b className="v2-flow-arrow" aria-hidden="true">→</b>}
            </article>
          ))}
        </HorizontalScroll>
      </section>

      <section className="v2-audience-buyers wrap v2-detail-section">
        <article><p className="v2-section-kicker">主要使用對象</p><TextLines value={active["主要使用對象"]} /></article>
        <article><p className="v2-section-kicker">實際採購對象</p><TextLines value={active["實際採購對象"]} /></article>
      </section>

      <nav className="v2-detail-nav wrap" aria-label="情境切換">
        <button type="button" onClick={() => onSelect(scenarios[(activeIndex - 1 + scenarios.length) % scenarios.length]["情境ID"])}>← 上一個情境</button>
        <button type="button" onClick={() => onSelect(null)}>回到總覽</button>
        <button type="button" onClick={() => onSelect(scenarios[(activeIndex + 1) % scenarios.length]["情境ID"])}>下一個情境 →</button>
      </nav>
      <footer className="wrap footer v2-footer"><span className="footer-team">打包一個家：未來生活的防災避難創新設計</span></footer>
    </main>
  );
}
