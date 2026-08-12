import type { ListViewCommandSetContext } from '@microsoft/sp-listview-extensibility';
import { SPFx, spfi, type SPFI } from '@pnp/sp';
import { ClientsidePageFromFile } from '@pnp/sp/clientside-pages';
import type { IFolderInfo } from '@pnp/sp/folders';
import '@pnp/sp/clientside-pages';
import '@pnp/sp/files';
import '@pnp/sp/files/web';
import '@pnp/sp/folders';
import '@pnp/sp/folders/web';
import '@pnp/sp/items';
import '@pnp/sp/webs';

import type {
  IFolderNode,
  ILoadFoldersResult,
  IMoveOperationResult,
  IMovePagesResult,
  IResolvedSitePagesLibrary
} from '../types';

const EXCLUDED_CHILD_FOLDER_NAMES: ReadonlySet<string> = new Set(['forms']);
const EXCLUDED_ROOT_FOLDER_NAMES: ReadonlySet<string> = new Set([
  'forms',
  'templates'
]);
const SITE_PAGES_SEGMENT: string = 'sitepages';
const CROSS_SITE_ACCESS_DENIED_MESSAGE: string =
  'SharePoint blocked moving this page to that site (often because Custom script / ' +
  'DenyAddAndCustomizePages is blocked on the destination). Allow custom script on the ' +
  'destination site, or ask a SharePoint admin to set DenyAddAndCustomizePages to false, then try again.';

export default class SitePagesFolderService {
  public readonly libraryServerRelativeUrl: string;
  public readonly webAbsoluteUrl: string;

  private readonly _context: ListViewCommandSetContext;
  private readonly _sourceWebAbsoluteUrl: string;
  private readonly _sp: SPFI;
  private _folderTreeCache: IFolderNode[] | undefined;
  private _folderTreePromise: Promise<IFolderNode[]> | undefined;

  public constructor(
    context: ListViewCommandSetContext,
    libraryServerRelativeUrl: string,
    webAbsoluteUrl?: string
  ) {
    this._context = context;
    this._sourceWebAbsoluteUrl = this._normalizeAbsoluteUrl(context.pageContext.web.absoluteUrl);
    this.webAbsoluteUrl = this._normalizeAbsoluteUrl(webAbsoluteUrl ?? this._sourceWebAbsoluteUrl);
    this.libraryServerRelativeUrl = this._normalizeServerRelativeUrl(libraryServerRelativeUrl);
    this._sp = spfi(this.webAbsoluteUrl).using(SPFx(context));
  }

  public static async createForSite(
    context: ListViewCommandSetContext,
    siteAbsoluteUrl: string
  ): Promise<SitePagesFolderService> {
    const resolved = await SitePagesFolderService.resolveSitePagesLibrary(context, siteAbsoluteUrl);
    return new SitePagesFolderService(
      context,
      resolved.libraryServerRelativeUrl,
      resolved.webAbsoluteUrl
    );
  }

  public static async resolveSitePagesLibrary(
    context: ListViewCommandSetContext,
    siteAbsoluteUrl: string
  ): Promise<IResolvedSitePagesLibrary> {
    const webAbsoluteUrl = SitePagesFolderService._normalizeAbsoluteUrlStatic(siteAbsoluteUrl);
    const sp = spfi(webAbsoluteUrl).using(SPFx(context));

    const web = await sp.web.select('ServerRelativeUrl', 'Url')();
    const webServerRelativeUrl = SitePagesFolderService._normalizeServerRelativeUrlStatic(
      web.ServerRelativeUrl
    );
    const resolvedWebAbsoluteUrl = SitePagesFolderService._normalizeAbsoluteUrlStatic(
      web.Url || webAbsoluteUrl
    );

    const parsedInput = SitePagesFolderService._tryParseUrlStatic(webAbsoluteUrl);
    const inputPath = SitePagesFolderService._normalizeServerRelativeUrlStatic(
      parsedInput?.pathname ?? '/'
    );
    const libraryServerRelativeUrl = SitePagesFolderService._resolveLibraryUrlFromInput(
      webServerRelativeUrl,
      inputPath
    );

    try {
      await sp.web
        .getFolderByServerRelativePath(libraryServerRelativeUrl)
        .select('ServerRelativeUrl', 'Exists')();
    } catch (error: unknown) {
      throw new Error(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Site Pages library was not found or is not accessible.'
      );
    }

    return {
      libraryServerRelativeUrl,
      webAbsoluteUrl: resolvedWebAbsoluteUrl,
      webServerRelativeUrl
    };
  }

  public static async loadFoldersForSite(
    context: ListViewCommandSetContext,
    siteAbsoluteUrl: string
  ): Promise<ILoadFoldersResult> {
    const service = await SitePagesFolderService.createForSite(context, siteAbsoluteUrl);
    const folders = await service.getFolderTree(true);

    return {
      folders,
      libraryServerRelativeUrl: service.libraryServerRelativeUrl,
      webAbsoluteUrl: service.webAbsoluteUrl
    };
  }

  public getCachedFolderTree(): IFolderNode[] | undefined {
    return this._folderTreeCache;
  }

  public async getFolderTree(forceRefresh = false): Promise<IFolderNode[]> {
    if (!forceRefresh && this._folderTreeCache !== undefined) {
      return this._folderTreeCache;
    }

    if (!forceRefresh && this._folderTreePromise) {
      return this._folderTreePromise;
    }

    this._folderTreePromise = this._loadFolderTree()
      .then((folders: IFolderNode[]) => {
        this._folderTreeCache = folders;
        return folders;
      })
      .finally(() => {
        this._folderTreePromise = undefined;
      });

    return this._folderTreePromise;
  }

  public async movePage(
    pageServerRelativeUrl: string,
    destinationFolderUrl: string,
    sourceWebAbsoluteUrl?: string
  ): Promise<IMoveOperationResult> {
    const normalizedSourceUrl = this._normalizeServerRelativeUrl(pageServerRelativeUrl);
    const normalizedDestinationFolderUrl = this._normalizeServerRelativeUrl(destinationFolderUrl);
    const fileName = this._getFileName(normalizedSourceUrl);
    const destinationFileServerRelativeUrl = `${normalizedDestinationFolderUrl}/${fileName}`;
    const sourceWebUrl = this._normalizeAbsoluteUrl(sourceWebAbsoluteUrl ?? this._sourceWebAbsoluteUrl);
    const isSameSite = this._isSameWeb(sourceWebUrl, this.webAbsoluteUrl);

    if (isSameSite) {
      await this._sp.web
        .getFileByServerRelativePath(normalizedSourceUrl)
        .moveByPath(destinationFileServerRelativeUrl, true);

      return {
        destinationFileUrl: destinationFileServerRelativeUrl
      };
    }

    const destinationAbsoluteUrl = this._toAbsoluteUrl(
      this.webAbsoluteUrl,
      destinationFileServerRelativeUrl
    );
    const sourceSp = spfi(sourceWebUrl).using(SPFx(this._context));

    try {
      await sourceSp.web
        .getFileByServerRelativePath(normalizedSourceUrl)
        .moveByPath(destinationAbsoluteUrl, true, {
          KeepBoth: false,
          RetainEditorAndModifiedOnMove: true,
          ShouldBypassSharedLocks: true
        });

      return {
        destinationFileUrl: destinationAbsoluteUrl
      };
    } catch (moveByPathError: unknown) {
      // Site Pages (.aspx) often fail MoveCopyUtil when custom script is blocked.
      // Fall back to modern page API copy + same-site folder move, then delete source.
      try {
        return await this._movePageViaClientsideCopy(
          sourceSp,
          normalizedSourceUrl,
          fileName,
          destinationFileServerRelativeUrl,
          destinationAbsoluteUrl
        );
      } catch (fallbackError: unknown) {
        throw new Error(this._formatCrossSiteMoveError(moveByPathError, fallbackError));
      }
    }
  }

  public async movePages(
    pageServerRelativeUrls: string[],
    destinationFolderUrl: string,
    sourceWebAbsoluteUrl?: string,
    onProgress?: (fileName: string, index: number, total: number) => void
  ): Promise<IMovePagesResult> {
    const results: IMoveOperationResult[] = [];
    const failures: IMovePagesResult['failures'] = [];
    const total = pageServerRelativeUrls.length;

    for (let index = 0; index < pageServerRelativeUrls.length; index++) {
      const pageServerRelativeUrl = pageServerRelativeUrls[index];
      const fileName = this._getFileName(this._normalizeServerRelativeUrl(pageServerRelativeUrl));
      onProgress?.(fileName, index, total);

      try {
        const result = await this.movePage(
          pageServerRelativeUrl,
          destinationFolderUrl,
          sourceWebAbsoluteUrl
        );
        results.push(result);
      } catch (error: unknown) {
        const message = error instanceof Error && error.message.trim()
          ? error.message
          : 'Move failed.';
        failures.push({
          fileName,
          message
        });
      }
    }

    return {
      failures,
      movedCount: results.length,
      results
    };
  }

  private async _movePageViaClientsideCopy(
    sourceSp: SPFI,
    sourceServerRelativeUrl: string,
    fileName: string,
    destinationFileServerRelativeUrl: string,
    destinationAbsoluteUrl: string
  ): Promise<IMoveOperationResult> {
    const pageName = fileName.replace(/\.aspx$/i, '');
    const sourcePage = await ClientsidePageFromFile(
      sourceSp.web.getFileByServerRelativePath(sourceServerRelativeUrl)
    );
    const pageTitle = (sourcePage.title || pageName).trim() || pageName;

    const destinationPage = await sourcePage.copy(
      this._sp.web,
      pageName,
      pageTitle,
      true
    );

    const destinationItem = await destinationPage.getItem<{
      FileRef?: string;
    }>('FileRef', 'FileLeafRef');
    const createdFileServerRelativeUrl = this._normalizeServerRelativeUrl(
      destinationItem.FileRef || `${this.libraryServerRelativeUrl}/${fileName}`
    );

    if (createdFileServerRelativeUrl.toLowerCase() !== destinationFileServerRelativeUrl.toLowerCase()) {
      await this._sp.web
        .getFileByServerRelativePath(createdFileServerRelativeUrl)
        .moveByPath(destinationFileServerRelativeUrl, true);
    }

    try {
      await sourcePage.delete();
    } catch {
      // Destination succeeded; source cleanup is best-effort.
    }

    return {
      destinationFileUrl: destinationAbsoluteUrl
    };
  }

  private _formatCrossSiteMoveError(primaryError: unknown, fallbackError: unknown): string {
    const primaryMessage = this._extractSharePointErrorMessage(primaryError);
    const fallbackMessage = this._extractSharePointErrorMessage(fallbackError);

    if (this._isAccessDeniedError(primaryError) || this._isAccessDeniedError(fallbackError)) {
      return CROSS_SITE_ACCESS_DENIED_MESSAGE;
    }

    const detail = fallbackMessage || primaryMessage;
    return detail
      ? `We couldn't move the page to that site. ${detail}`
      : 'We couldn\'t move the page to that site.';
  }

  private _extractSharePointErrorMessage(error: unknown): string | undefined {
    if (!(error instanceof Error) || !error.message.trim()) {
      return typeof error === 'string' && error.trim() ? error.trim() : undefined;
    }

    const rawMessage = error.message.trim();
    const payloadMarker = '::>';
    const payloadIndex = rawMessage.indexOf(payloadMarker);
    const payloadText = payloadIndex >= 0
      ? rawMessage.slice(payloadIndex + payloadMarker.length).trim()
      : rawMessage;

    try {
      const parsed = JSON.parse(payloadText) as {
        'odata.error'?: {
          message?: {
            value?: string;
          };
        };
        error?: {
          message?: string;
        };
        message?: string | {
          value?: string;
        };
      };

      const odataValue = parsed['odata.error']?.message?.value;
      if (odataValue?.trim()) {
        return odataValue.trim();
      }

      if (typeof parsed.error?.message === 'string' && parsed.error.message.trim()) {
        return parsed.error.message.trim();
      }

      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }

      if (parsed.message && typeof parsed.message === 'object' && parsed.message.value?.trim()) {
        return parsed.message.value.trim();
      }
    } catch {
      // Not JSON — fall through to cleaned raw text.
    }

    const cleaned = payloadText
      .replace(/^Error making HttpClient request in queryable\s*\[[^\]]*\]\s*[^=]*::>\s*/i, '')
      .trim();

    return cleaned || rawMessage;
  }

  private _isAccessDeniedError(error: unknown): boolean {
    const message = (
      this._extractSharePointErrorMessage(error) ||
      (error instanceof Error ? error.message : String(error ?? ''))
    ).toLowerCase();

    return message.includes('access denied') ||
      message.includes('unauthorized') ||
      message.includes('403') ||
      message.includes('denyaddandcustomizepages') ||
      message.includes('add and customize pages');
  }

  private async _loadFolderTree(): Promise<IFolderNode[]> {
    return this._loadChildFolders(this.libraryServerRelativeUrl, 0);
  }

  private async _loadChildFolders(parentFolderUrl: string, depth: number): Promise<IFolderNode[]> {
    const folders: IFolderInfo[] = await this._sp.web
      .getFolderByServerRelativePath(this._normalizeServerRelativeUrl(parentFolderUrl))
      .folders();

    const eligibleFolders: IFolderInfo[] = folders
      .filter((folder: IFolderInfo) => this._isEligibleFolder(folder.Name, depth))
      .sort((left: IFolderInfo, right: IFolderInfo) => left.Name.localeCompare(right.Name));

    const childNodes: IFolderNode[] = [];

    for (const folder of eligibleFolders) {
      let children: IFolderNode[] = [];

      try {
        children = await this._loadChildFolders(folder.ServerRelativeUrl, depth + 1);
      } catch {
        children = [];
      }

      childNodes.push({
        children,
        name: folder.Name,
        serverRelativeUrl: this._normalizeServerRelativeUrl(folder.ServerRelativeUrl)
      });
    }

    return childNodes;
  }

  private _getFileName(fileServerRelativeUrl: string): string {
    const segments = fileServerRelativeUrl.split('/').filter(Boolean);
    return segments[segments.length - 1];
  }

  private _isEligibleFolder(folderName: string, depth: number): boolean {
    const normalizedName = folderName.trim().toLowerCase();

    if (depth === 0) {
      return !EXCLUDED_ROOT_FOLDER_NAMES.has(normalizedName);
    }

    return !EXCLUDED_CHILD_FOLDER_NAMES.has(normalizedName);
  }

  private _isSameWeb(leftAbsoluteUrl: string, rightAbsoluteUrl: string): boolean {
    return this._normalizeAbsoluteUrl(leftAbsoluteUrl).toLowerCase() ===
      this._normalizeAbsoluteUrl(rightAbsoluteUrl).toLowerCase();
  }

  private _toAbsoluteUrl(webAbsoluteUrl: string, serverRelativeUrl: string): string {
    const parsedWeb = this._tryParseUrl(webAbsoluteUrl);
    if (!parsedWeb) {
      throw new Error('Invalid site URL.');
    }

    const normalizedPath = this._normalizeServerRelativeUrl(serverRelativeUrl);
    return `${parsedWeb.origin}${normalizedPath}`;
  }

  private _normalizeAbsoluteUrl(absoluteUrl: string): string {
    return SitePagesFolderService._normalizeAbsoluteUrlStatic(absoluteUrl);
  }

  private _normalizeServerRelativeUrl(serverRelativeUrl: string): string {
    return SitePagesFolderService._normalizeServerRelativeUrlStatic(serverRelativeUrl);
  }

  private _tryParseUrl(value: string): URL | undefined {
    return SitePagesFolderService._tryParseUrlStatic(value);
  }

  private static _resolveLibraryUrlFromInput(
    webServerRelativeUrl: string,
    inputPath: string
  ): string {
    const normalizedWebUrl = this._normalizeServerRelativeUrlStatic(webServerRelativeUrl);
    const normalizedInputPath = this._normalizeServerRelativeUrlStatic(inputPath).toLowerCase();
    const webPrefix = normalizedWebUrl.toLowerCase();

    if (
      normalizedInputPath === `${webPrefix}/${SITE_PAGES_SEGMENT}` ||
      normalizedInputPath.endsWith(`/${SITE_PAGES_SEGMENT}`)
    ) {
      if (normalizedInputPath.startsWith(webPrefix)) {
        return this._normalizeServerRelativeUrlStatic(inputPath);
      }
    }

    if (normalizedWebUrl === '/') {
      return '/SitePages';
    }

    return `${normalizedWebUrl}/SitePages`;
  }

  private static _normalizeAbsoluteUrlStatic(absoluteUrl: string): string {
    const trimmedValue = absoluteUrl.trim();
    const parsed = this._tryParseUrlStatic(trimmedValue);

    if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
      throw new Error('Enter a valid HTTPS SharePoint site URL.');
    }

    // Prefer https for SharePoint Online destinations.
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }

    const path = this._normalizeServerRelativeUrlStatic(parsed.pathname);
    return path === '/'
      ? parsed.origin
      : `${parsed.origin}${path}`;
  }

  private static _normalizeServerRelativeUrlStatic(serverRelativeUrl: string): string {
    const trimmedValue = serverRelativeUrl.trim();

    if (!trimmedValue) {
      return '/';
    }

    const withLeadingSlash = trimmedValue.startsWith('/')
      ? trimmedValue
      : `/${trimmedValue}`;
    const normalizedValue = withLeadingSlash.replace(/\/+$/, '');

    return normalizedValue || '/';
  }

  private static _tryParseUrlStatic(value: string): URL | undefined {
    try {
      return new URL(value);
    } catch {
      return undefined;
    }
  }
}
