import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { BuildingApprovalsApp } from "./components/BuildingApprovalsApp";
import { WebApiClient } from "./services/WebApiClient";

export class BuildingApprovalsControl implements ComponentFramework.ReactControl<IInputs, IOutputs> {
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
        // No-op: this control does its own CRUD via the Dataverse client rather than reading
        // context.parameters — see updateView.
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        // TODO (docs/open-questions.md item 1): confirm context.webAPI actually works for this control
        // when hosted inside Power Pages (as opposed to a model-driven app) — if it doesn't, swap this
        // for a PortalRestClient(siteBaseUrl) instance instead. Keep the swap isolated to this one line.
        const client = new WebApiClient(context.webAPI);

        // TODO: confirm how the signed-in CIAM contact's id is actually exposed to a Power Pages-hosted
        // PCF (context.userSettings.userId is the model-driven-app convention and may not map directly
        // under Microsoft Entra External ID auth — see docs/open-questions.md item 1).
        const contactId = context.userSettings.userId;

        return React.createElement(BuildingApprovalsApp, { client, contactId });
    }

    public getOutputs(): IOutputs {
        return { };
    }

    public destroy(): void {
        // No-op: virtual (React) controls are unmounted by the platform.
    }
}
