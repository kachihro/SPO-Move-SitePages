/**
 * Hides native Power Pages Basic Form chrome that sits outside this PCF
 * (empty section rows, PCF Anchor label + form Submit).
 *
 * Inject as early as the bundle evaluates so the label does not flash before React mounts.
 * For a true zero-flash (CSS before our JS downloads), also add the same selectors to the
 * Approvals page Custom CSS in Power Pages Studio.
 */

export const PORTAL_CHROME_STYLE_ID = "aal-ba-portal-chrome-hide";

/** Match the original `.aal-submissions` middle pane. */
const PAGE_MAX_WIDTH = "1288px";

export const PORTAL_CHROME_CSS = `
#cr0e0_pcfanchor_label,
label[id$="pcfanchor_label"],
label[for*="pcfanchor"],
label[id*="pcfanchor"],
/* Label + validator chrome above the PCF host */
.table-info:has(#cr0e0_pcfanchor_label),
.table-info:has(label[for*="pcfanchor"]),
.table-info:has(label[id*="pcfanchor"]),
.crmEntityFormView .actions,
.crmEntityFormView .cell.zero-cell,
.crmEntityFormView legend,
fieldset[aria-label="PCF"] > legend,
input[type="submit"][id*="InsertButton"],
input[type="submit"].btn-primary,
.entity-form .actions,
button#InsertButton,
#InsertButton,
form.entity-form input[type="submit"],
.crmEntityFormView input[type="submit"],
/* Empty spacer rows above the PCF control in the Basic Form section */
table[data-name="panel_PCF"] > tbody > tr:not(:has([data-logical-name="cr0e0_pcfanchor"])),
table[data-name="panel_PCF"] > tbody > tr:not(:has(.control[data-logical-name*="pcfanchor"])) {
  display: none !important;
}

/* Kill portal theme cell padding that insets the Basic Form / PCF host */
.crmEntityFormView .cell {
  padding: 0 !important;
}

/*
 * Power Pages Bootstrap .container (~1170px) + section padding inset the PCF.
 * Cap the host at the original middle-pane width and collapse top spacing so
 * the beige panel sits under the header like the original page.
 */
body:has(.aal-ba-shell) #mainContent,
body:has(#BuildingApprovalsControl) #mainContent,
body:has(.aal-ba-shell) .page-copy,
body:has(#BuildingApprovalsControl) .page-copy,
body:has(.aal-ba-shell) .page-content,
body:has(#BuildingApprovalsControl) .page-content {
  padding-top: 0 !important;
  margin-top: 0 !important;
}

.row.sectionBlockLayout:has([data-logical-name*="pcfanchor"]),
.row.sectionBlockLayout:has(.aal-ba-shell),
.row.sectionBlockLayout:has(#BuildingApprovalsControl) {
  margin: 0 !important;
  padding: 0 !important;
  min-height: 0 !important;
  width: 100% !important;
  max-width: none !important;
}

.container:has([data-logical-name*="pcfanchor"]),
.container:has(.aal-ba-shell),
.container:has(#BuildingApprovalsControl),
.container-fluid:has([data-logical-name*="pcfanchor"]),
.container-fluid:has(.aal-ba-shell),
.container-fluid:has(#BuildingApprovalsControl) {
  max-width: ${PAGE_MAX_WIDTH} !important;
  width: 100% !important;
  padding-left: 16px !important;
  padding-right: 16px !important;
  padding-top: 0 !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.col-lg-12.columnBlockLayout:has([data-logical-name*="pcfanchor"]),
.col-lg-12.columnBlockLayout:has(.aal-ba-shell),
.col-lg-12.columnBlockLayout:has(#BuildingApprovalsControl),
.columnBlockLayout:has([data-logical-name*="pcfanchor"]),
.columnBlockLayout:has(.aal-ba-shell),
.columnBlockLayout:has(#BuildingApprovalsControl) {
  width: 100% !important;
  max-width: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
  flex-grow: 1 !important;
}

form.entity-form:has([data-logical-name*="pcfanchor"]),
form.entity-form:has(.aal-ba-shell),
.crmEntityFormView:has([data-logical-name*="pcfanchor"]),
.crmEntityFormView:has(.aal-ba-shell) {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
}

/*
 * Power Apps host applies .flexbox { display:flex; width:100% } with default
 * flex-direction:row. That sizes the host, but React roots stay content-width
 * on the left — empty host background (your red debug) appears as a right strip.
 * Column + stretch makes children take the full host width.
 */
#cr0e0_pcfanchor_ControlView,
#BuildingApprovalsControl,
#BuildingApprovalsControl [id$="-pcf-container-id"],
table[data-name="panel_PCF"],
table[data-name="panel_PCF"] > tbody,
table[data-name="panel_PCF"] > tbody > tr,
table[data-name="panel_PCF"] > tbody > tr > td,
.crmEntityFormView table[data-name="panel_PCF"] .control {
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 !important;
}

#cr0e0_pcfanchor_ControlView > *,
#BuildingApprovalsControl > *,
#BuildingApprovalsControl [id$="-pcf-container-id"] > * {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  flex: 1 1 auto !important;
}
`;

function hidePcfAnchorText(): void {
  const labels = Array.from(
    document.querySelectorAll<HTMLElement>(
      "#cr0e0_pcfanchor_label, label[id$='pcfanchor_label'], label[for*='pcfanchor'], label[id*='pcfanchor']"
    )
  );
  for (const label of labels) {
    label.style.display = "none";
    const tableInfo = label.closest<HTMLElement>(".table-info");
    if (tableInfo) tableInfo.style.display = "none";
  }

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("label, .control-label, .field-label, td, th, span, div, legend")
  );
  for (const el of candidates) {
    const text = (el.textContent ?? "").trim();
    if (text === "PCF Anchor" || text === "PCFAnchor") {
      el.style.display = "none";
      const tableInfo = el.closest<HTMLElement>(".table-info");
      if (tableInfo) tableInfo.style.display = "none";
    }
  }
}

/** Fallback when :has() is unavailable — hide spacer TRs above the PCF host. */
function hideEmptyPcfSectionRows(): void {
  const tables = Array.from(
    document.querySelectorAll<HTMLTableElement>('table[data-name="panel_PCF"], table.section')
  );
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>(":scope > tbody > tr"));
    const hasPcf = rows.some((row) => !!row.querySelector('[data-logical-name*="pcfanchor"]'));
    if (!hasPcf) continue;
    for (const row of rows) {
      if (!row.querySelector('[data-logical-name*="pcfanchor"]')) {
        row.style.display = "none";
      }
    }
  }
}

/** Basic Form Insert creates an empty BA Application — this PCF owns create via webAPI. */
function blockNativeFormInsert(): void {
  const forms = Array.from(
    document.querySelectorAll<HTMLFormElement>("form.entity-form, .crmEntityFormView form, form[data-form-name]")
  );
  for (const form of forms) {
    if (form.dataset.aalInsertBlocked === "1") continue;
    form.dataset.aalInsertBlocked = "1";
    form.addEventListener(
      "submit",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );
  }
}

export function applyPortalChromeHides(): void {
  if (typeof document === "undefined") return;
  hidePcfAnchorText();
  hideEmptyPcfSectionRows();
  blockNativeFormInsert();
}

export function ensurePortalChromeStyle(): void {
  if (typeof document === "undefined" || !document.head) return;
  const existing = document.getElementById(PORTAL_CHROME_STYLE_ID) as HTMLStyleElement | null;
  if (existing) {
    if (existing.textContent !== PORTAL_CHROME_CSS) {
      existing.textContent = PORTAL_CHROME_CSS;
    }
    return;
  }
  const style = document.createElement("style");
  style.id = PORTAL_CHROME_STYLE_ID;
  style.textContent = PORTAL_CHROME_CSS;
  document.head.appendChild(style);
}

/** Earliest PCF-side hide: style tag + DOM walk. Safe to call repeatedly. */
export function ensurePortalChromeHidden(): void {
  ensurePortalChromeStyle();
  applyPortalChromeHides();
}

// Run as soon as this module is evaluated (before init / React mount).
ensurePortalChromeHidden();
