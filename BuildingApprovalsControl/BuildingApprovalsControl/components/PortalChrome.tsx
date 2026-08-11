import * as React from "react";
import { applyPortalChromeHides, ensurePortalChromeStyle } from "../portalChromeHide";

/**
 * Keeps portal chrome hidden after React mounts (MutationObserver for late DOM),
 * matching the original page mockup. Style is also injected at bundle load via portalChromeHide.
 */
export const PortalChrome: React.FC = () => {
  React.useEffect(() => {
    ensurePortalChromeStyle();
    applyPortalChromeHides();

    const observer = new MutationObserver(() => {
      applyPortalChromeHides();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = window.setTimeout(applyPortalChromeHides, 500);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      // Leave the style tag in place so remounts do not re-flash the label.
    };
  }, []);

  return null;
};
