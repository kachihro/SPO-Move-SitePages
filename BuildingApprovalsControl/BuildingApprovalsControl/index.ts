import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { BuildingApprovalsApp } from "./components/BuildingApprovalsApp";
import { ensurePortalChromeHidden } from "./portalChromeHide";
import { resolvePortalContactId } from "./services/portalContactId";
import { WebApiClient } from "./services/WebApiClient";

export class BuildingApprovalsControl implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private client: WebApiClient | undefined;

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
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        // TODO (docs/open-questions.md item 1): confirm context.webAPI actually works for this control
        // when hosted inside Power Pages (as opposed to a model-driven app) — if it doesn't, swap this
        // for a PortalRestClient(siteBaseUrl) instance instead. Keep the swap isolated to this one line.
        this.client ??= new WebApiClient(context.webAPI);

        // Power Pages often leaves userSettings.userId empty — prefer Liquid-rendered #aal-portal-contact-id.
        const contactId = resolvePortalContactId(context.userSettings?.userId);

        return React.createElement(BuildingApprovalsApp, { client: this.client, contactId });
    }

    public getOutputs(): IOutputs {
        return { };
    }

    public destroy(): void {
        // No-op: virtual (React) controls are unmounted by the platform.
    }
}
