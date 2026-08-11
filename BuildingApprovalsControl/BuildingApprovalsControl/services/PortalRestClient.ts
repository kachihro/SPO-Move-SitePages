import { DataverseClient } from "./DataverseClient";
import {
  BUILDING_APPROVAL_ENTITY_SET,
  BUILDING_APPROVAL_GRID_SELECT,
  BUILDING_APPROVAL_WEBAPI_SELECT,
  BuildingApprovalEntity,
  BuildingApprovalRecord,
} from "../types/BuildingApproval";
import { mapFromRecord, mapToRecord, normalizeGuid, portalUserLookupPayloads } from "./mapping";

interface ODataListResponse {
  value: BuildingApprovalEntity[];
}

declare global {
  interface Window {
    // Power Pages injects a "shell" object exposing token retrieval on most portal releases.
    // TODO: confirm this against the live site — Microsoft has changed the mechanism across
    // portal releases (see docs/open-questions.md item 2). If `shell` isn't present, look for a
    // `__RequestVerificationToken` value embedded in a hidden form field or meta tag instead.
    shell?: { getTokenDeferred?: () => Promise<string> };
  }
}

/**
 * Fallback implementation for when context.webAPI is unavailable/unreliable inside a Power
 * Pages-hosted PCF. Not currently used — WebApiClient (context.webAPI) is confirmed working against
 * this org under real CIAM portal-contact auth, see docs/open-questions.md item 1 — but kept as a
 * fallback in case a different target environment behaves differently.
 */
export class PortalRestClient implements DataverseClient {
  constructor(private readonly siteBaseUrl: string) {}

  public async retrieveMultiple(contactId: string): Promise<BuildingApprovalRecord[]> {
    const query = `?$select=${BUILDING_APPROVAL_GRID_SELECT}&$orderby=cr137_applicationdate desc`;
    const res = await this.request("GET", `${BUILDING_APPROVAL_ENTITY_SET}${query}`);
    const json = (await res.json()) as ODataListResponse;
    const records = (json.value ?? []).map(mapToRecord);
    const normalized = normalizeGuid(contactId).toLowerCase();
    return records.filter((r) => normalizeGuid(r.portalUserId ?? "").toLowerCase() === normalized);
  }

  public async retrieve(id: string): Promise<BuildingApprovalRecord> {
    const normalizedId = normalizeGuid(id);
    const res = await this.request(
      "GET",
      `${BUILDING_APPROVAL_ENTITY_SET}(${normalizedId})?$select=${BUILDING_APPROVAL_WEBAPI_SELECT}`
    );
    const json = (await res.json()) as BuildingApprovalEntity;
    return mapToRecord(json);
  }

  public async create(data: Partial<BuildingApprovalRecord>): Promise<string> {
    if (!data.portalUserId) {
      throw new Error(
        'Cannot create Building Activity Application without Portal User (contact). Add <input type="hidden" id="aal-portal-contact-id" value="{{ user.id }}" /> on the Submissions page.'
      );
    }
    const { odata } = portalUserLookupPayloads(data.portalUserId);
    const res = await this.request("POST", BUILDING_APPROVAL_ENTITY_SET, {
      ...mapFromRecord(data),
      ...odata,
    });
    const location = res.headers.get("OData-EntityId") ?? "";
    const match = /\(([0-9a-fA-F-]+)\)/.exec(location);
    if (!match) {
      throw new Error("Portal REST create did not return an OData-EntityId header with a record id.");
    }
    const id = normalizeGuid(match[1]);
    await this.request("PATCH", `${BUILDING_APPROVAL_ENTITY_SET}(${id})`, odata);
    return id;
  }

  public async update(id: string, data: Partial<BuildingApprovalRecord>): Promise<void> {
    const payload = mapFromRecord(data);
    if (data.portalUserId) {
      Object.assign(payload, portalUserLookupPayloads(data.portalUserId).odata);
    }
    await this.request("PATCH", `${BUILDING_APPROVAL_ENTITY_SET}(${normalizeGuid(id)})`, payload);
  }

  public async deleteRecord(id: string): Promise<void> {
    await this.request("DELETE", `${BUILDING_APPROVAL_ENTITY_SET}(${normalizeGuid(id)})`);
  }

  private async getToken(): Promise<string | undefined> {
    return window.shell?.getTokenDeferred?.();
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (token) headers.__RequestVerificationToken = token;

    const res = await fetch(`${this.siteBaseUrl.replace(/\/$/, "")}/_api/${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Portal REST ${method} ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res;
  }
}
