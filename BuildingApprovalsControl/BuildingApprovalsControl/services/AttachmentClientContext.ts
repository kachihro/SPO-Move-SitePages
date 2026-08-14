import * as React from "react";
import { AttachmentClient } from "./AttachmentClient";
import { PortalAnnotationClient } from "./PortalAnnotationClient";

/**
 * Has a real default (unlike DataverseClientContext) because the portal implementation needs no
 * constructor arguments — so a component still works if it renders outside the Provider.
 */
export const AttachmentClientContext = React.createContext<AttachmentClient>(new PortalAnnotationClient());

export function useAttachmentClient(): AttachmentClient {
  return React.useContext(AttachmentClientContext);
}
