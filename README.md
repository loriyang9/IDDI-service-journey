# 防災避難服務流程分析

把「打包一個家」研究資料轉成可探索的服務流程網站。網站沿著七個核心場景，呈現不同族群需求、服務提供者考量，以及關鍵情境的設計挑戰與技術解題重點。

## 本機啟動

- Node.js `>=22.13.0`

```bash
npm install
npm run dev
npm run build
```

開啟 `http://localhost:3000`。

## Google Sheet 資料接口

網站只讀取以下三張工作表，不會寫回試算表：

- `網站主表`
- `關鍵情境對照表`
- `現場與案例`

### 網站文字要改哪裡

日常更新直接修改 Google Sheet，重新整理網站即可看到變更：

- `網站主表`
  - `G 場景通用需求（報告2-2原文）`：場景詳情中的完整「場景需求」
  - `I 主要服務提供者`、`J 服務內容`、`K 服務端共通痛點`
  - `M 族群`、`N 子族群`、`O 族群需求`
  - `Q 服務端挑戰／考量重點（AI草稿）`
  - `T 關鍵情境ID`：控制需求與關鍵情境的對應
  - `X 場景需求摘要`：首頁七個場景的三點摘要
- `關鍵情境對照表`
  - `B 情境名稱`、`C 色彩HEX`
  - `F 設計挑戰`、`G 技術解題重點`

工作表分頁名稱與第一列欄位標題是資料接口的讀取依據；若要再改名，需要同步調整網站與 Apps Script。原始的 `完整流程分析` 不在接口範圍內。

Apps Script 程式位於 `apps-script/Code.gs`。部署為網頁應用程式後，在 `.env.local` 設定：

```env
NEXT_PUBLIC_SHEET_API_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

未設定或接口暫時無法連線時，網站會使用 `app/data/sheet-fallback.json`，畫面不會空白。

## 響應式互動

- 桌機：七個場景完整並排，整頁使用單一垂直捲動；階段、時間與核心場景會固定在篩選列下方。
- 手機與窄版：整頁負責垂直捲動、流程表只負責水平滑動；族群與關鍵情境按鈕可水平滑動選擇。
- 手機選取族群或關鍵情境後，需求、因應策略、設計挑戰與技術解題重點會直接在原流程中展開；只有場景全文沿用獨立詳情視窗。

## 常用指令

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm run build:pages`：產生 GitHub Pages 使用的靜態網站
- `npm test`：建置並檢查主要內容與資料結構
- `npm run lint`：檢查程式碼

## GitHub Pages

推送到 `main` 後，`.github/workflows/pages.yml` 會自動建置並發布網站。工作流程會依倉庫名稱設定子路徑，因此圖片與互動資源可在專案型 GitHub Pages 網址正常載入。
