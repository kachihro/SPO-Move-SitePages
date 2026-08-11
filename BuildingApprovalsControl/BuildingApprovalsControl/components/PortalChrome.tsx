import * as React from "react";

/**
 * Hides native Power Pages Basic Form chrome that sits outside this PCF
 * (PCF Anchor field label + form Submit), matching the original page mockup.
 */
const PORTAL_CHROME_CSS = `
#cr0e0_pcfanchor_label,
label[id$="pcfanchor_label"],
label[for*="pcfanchor"],
.crmEntityFormView .actions,
.crmEntityFormView .cell.zero-cell,
.crmEntityFormView legend,
input[type="submit"][id*="InsertButton"],
input[type="submit"].btn-primary,
.entity-form .actions,
button#InsertButton,
#InsertButton {
  display: none !important;
}
`;

function hidePcfAnchorText(): void {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("label, .control-label, .field-label, td, th, span, div")
  );
  for (const el of candidates) {
    const text = (el.textContent ?? "").trim();
    if (text === "PCF Anchor" || text === "PCFAnchor") {
      el.style.display = "none";
    }
  }
}

export const PortalChrome: React.FC = () => {
  React.useEffect(() => {
    const id = "aal-ba-portal-chrome-hide";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = PORTAL_CHROME_CSS;
      document.head.appendChild(style);
    }
    hidePcfAnchorText();
    const timer = window.setTimeout(hidePcfAnchorText, 500);
    return () => {
      window.clearTimeout(timer);
      document.getElementById(id)?.remove();
    };
  }, []);

  return null;
};
