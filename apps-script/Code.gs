const SPREADSHEET_ID = "1GIYgRjDdqRQ7qh9YaT6hT_gtPSgiLsR11C0RngMyGg4";
const ALLOWED_SHEETS = ["網站主表", "關鍵情境對照表", "現場與案例"];

function doGet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const payload = {
    main: readSheet_(spreadsheet, ALLOWED_SHEETS[0]),
    scenarios: readSheet_(spreadsheet, ALLOWED_SHEETS[1]),
    media: readSheet_(spreadsheet, ALLOWED_SHEETS[2]),
    updatedAt: new Date().toISOString(),
  };

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function readSheet_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error("找不到允許的工作表：" + sheetName);

  return {
    range: sheetName + "!" + sheet.getDataRange().getA1Notation(),
    values: sheet.getDataRange().getDisplayValues(),
  };
}
