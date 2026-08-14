import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { BuildingApprovalsApp } from "./components/BuildingApprovalsApp";
import { ensurePortalChromeHidden } from "./portalChromeHide";
import { resolvePortalContactId } from "./services/portalContactId";
import { WebApiClient } from "./services/WebApiClient";
import { AttachmentClient } from "./services/AttachmentClient";
import { MockAttachmentClient } from "./services/MockAttachmentClient";
import { PortalAnnotationClient } from "./services/PortalAnnotationClient";

/** The dev harness has no `/_api/` to talk to — see MockAttachmentClient. */
function createAttachmentClient(): AttachmentClient {
    const isHarness = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    return isHarness ? new MockAttachmentClient() : new PortalAnnotationClient();
}

export class BuildingApprovalsControl implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private client: WebApiClient | undefined;
    private attachments: AttachmentClient | undefined;

    /**
     * Empty constructor.
     */
    constructor() {
        // Empty
    }

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary
    ): void {
        // Hide "PCF Anchor" / Basic Form Submit as early as the control lifecycle allows.
        // (Also runs at module import — this covers harness / late init cases.)
        ensurePortalChromeHidden();
        // Stable client instance — recreating on every updateView re-fired the wizard load effect
        // (context value identity change) and could leave the form empty after open.
        this.client = new WebApiClient(context.webAPI);
        this.attachments = createAttachmentClient();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        // TODO (docs/open-questions.md item 1): confirm context.webAPI actually works for this control
        // when hosted inside Power Pages (as opposed to a model-driven app) — if it doesn't, swap this
        // for a PortalRestClient(siteBaseUrl) instance instead. Keep the swap isolated to this one line.
        this.client ??= new WebApiClient(context.webAPI);
        this.attachments ??= createAttachmentClient();

        // Power Pages often leaves userSettings.userId empty — prefer Liquid-rendered #aal-portal-contact-id.
        const contactId = resolvePortalContactId(context.userSettings?.userId);

        return React.createElement(BuildingApprovalsApp, {
            client: this.client,
            attachmentClient: this.attachments,
            contactId,
        });
    }

    public getOutputs(): IOutputs {
        return { };
    }

    public destroy(): void {
        // No-op: virtual (React) controls are unmounted by the platform.
    }
}
