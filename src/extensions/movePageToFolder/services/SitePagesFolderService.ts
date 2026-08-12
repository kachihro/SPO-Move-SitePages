import type { ListViewCommandSetContext } from '@microsoft/sp-listview-extensibility';
import { SPFx, spfi, type SPFI } from '@pnp/sp';
import type { IFieldInfo } from '@pnp/sp/fields';
import type { IFolderInfo } from '@pnp/sp/folders';
import '@pnp/sp/files';
import '@pnp/sp/files/web';
import '@pnp/sp/folders';
import '@pnp/sp/folders/web';
import '@pnp/sp/items';
import '@pnp/sp/lists';
import '@pnp/sp/fields';
import '@pnp/sp/webs';

import * as strings from 'MovePageToFolderCommandSetStrings';
import type {
  IFolderNode,
  IMetadataField,
  IMoveOperationResult,
  ISelectedPageInfo
} from '../types';

const EXCLUDED_CHILD_FOLDER_NAMES: ReadonlySet<string> = new Set(['forms']);
const EXCLUDED_ROOT_FOLDER_NAMES: ReadonlySet<string> = new Set([
  'forms',
  'templates'
]);

const EXCLUDED_FIELD_INTERNAL_NAMES: ReadonlySet<string> = new Set([
  'id',
  'fileleafref',
  'fileref',
  'filedirref',
  'uniqueid',
  'guid',
  'contenttypeid',
  'checkoutuser',
  'modified',
  'created',
  'editor',
  'author',
  'filesystemobjecttype',
  'fsobjtype',
  'permalink',
  'docicon',
  'edit',
  'linkfilename',
  'linkfilename2',
  'linkfilenamenomenu',
  'serverurl',
  'encodedabsurl',
  'filename',
  'filesize',
  'file_x0020_type',
  'htmldescription',
  'canvascontent1',
  'layoutwebpartscontent',
  'clientformid',
  'complianceassetid',
  'owshiddenversion',
  'scopeid',
  'workflowversion',
  'workflowinstanceid',
  'parentversionstring',
  'parentleafname',
  '_uiversionstring',
  '_uiversion',
  '_moderationstatus',
  '_level',
  '_isrecord',
  'smlastmodifieddate',
  'promotedstate'
]);

const EXCLUDED_FIELD_TYPES: ReadonlySet<string> = new Set([
  'attachments',
  'calculated',
  'computed',
  'contenttype',
  'counter',
  'crossprojectlink',
  'error',
  'file',
  'maxitems',
  'lookup',
  'lookupmulti',
  'taxonomyfieldtype',
  'taxonomyfieldtypemulti',
  'user',
  'usermulti',
  'workflow',
  'workflowstatus'
]);

export interface ICrossSiteMoveParams {
  destinationFolderUrl: string;
  destinationWebAbsoluteUrl: string;
  page: ISelectedPageInfo;
  selectedFieldInternalNames: string[];
  sourceLibraryServerRelativeUrl: string;
}

export default class SitePagesFolderService {
  private readonly _context: ListViewCommandSetContext;
  private readonly _sourceSp: SPFI;
  private readonly _folderTreeCache = new Map<string, IFolderNode[]>();
  private readonly _folderTreePromises = new Map<string, Promise<IFolderNode[]>>();

  public constructor(context: ListViewCommandSetContext) {
    this._context = context;
    this._sourceSp = spfi().using(SPFx(context));
  }

  public getCachedFolderTree(libraryServerRelativeUrl: string): IFolderNode[] | undefined {
    return this._folderTreeCache.get(this._normalizeServerRelativeUrl(libraryServerRelativeUrl));
  }

  public async getFolderTree(
    libraryServerRelativeUrl: string,
    webAbsoluteUrl?: string,
    forceRefresh = false
  ): Promise<IFolderNode[]> {
    const normalizedLibraryUrl = this._normalizeServerRelativeUrl(libraryServerRelativeUrl);
    const cacheKey = this._folderCacheKey(normalizedLibraryUrl, webAbsoluteUrl);

    if (!forceRefresh) {
      const cached = this._folderTreeCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      const inFlight = this._folderTreePromises.get(cacheKey);
      if (inFlight) {
        return inFlight;
      }
    }

    const loadPromise = this._loadFolderTree(normalizedLibraryUrl, webAbsoluteUrl)
      .then((folders: IFolderNode[]) => {
        this._folderTreeCache.set(cacheKey, folders);
        return folders;
      })
      .finally(() => {
        this._folderTreePromises.delete(cacheKey);
      });

    this._folderTreePromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  public async getMatchingMetadataFields(
    sourceLibraryServerRelativeUrl: string,
    destinationWebAbsoluteUrl: string
  ): Promise<IMetadataField[]> {
    const sourceSp = this._sourceSp;
    const destinationSp = this._getSpForWeb(destinationWebAbsoluteUrl);

    const destinationLibraryUrl = await this._resolveSitePagesLibraryUrl(destinationSp);
    const [sourceFields, destinationFields] = await Promise.all([
      this._getListFields(sourceSp, sourceLibraryServerRelativeUrl),
      this._getListFields(destinationSp, destinationLibraryUrl)
    ]);

    const destinationByInternalName = new Map(
      destinationFields
        .filter((field) => this._isEligibleMetadataField(field))
        .map((field) => [field.InternalName.toLowerCase(), field])
    );

    const matchingFields: IMetadataField[] = [];

    for (const sourceField of sourceFields) {
      if (!this._isEligibleMetadataField(sourceField)) {
        continue;
      }

      const destinationField = destinationByInternalName.get(sourceField.InternalName.toLowerCase());
      if (!destinationField) {
        continue;
      }

      if (destinationField.TypeAsString.toLowerCase() !== sourceField.TypeAsString.toLowerCase()) {
        continue;
      }

      matchingFields.push({
        displayName: sourceField.Title || sourceField.InternalName,
        internalName: sourceField.InternalName,
        typeAsString: sourceField.TypeAsString
      });
    }

    matchingFields.sort((left, right) => left.displayName.localeCompare(right.displayName));
    return matchingFields;
  }

  public async movePageSameSite(
    pageServerRelativeUrl: string,
    destinationFolderUrl: string
  ): Promise<IMoveOperationResult> {
    const normalizedSourceUrl = this._normalizeServerRelativeUrl(pageServerRelativeUrl);
    const normalizedDestinationFolderUrl = this._normalizeServerRelativeUrl(destinationFolderUrl);
    const destinationFileUrl = `${normalizedDestinationFolderUrl}/${this._getFileName(normalizedSourceUrl)}`;

    await this._sourceSp.web
      .getFileByServerRelativePath(normalizedSourceUrl)
      .moveByPath(destinationFileUrl, true);

    return {
      destinationFileUrl
    };
  }

  public async movePageCrossSite(params: ICrossSiteMoveParams): Promise<IMoveOperationResult> {
    const destinationSp = this._getSpForWeb(params.destinationWebAbsoluteUrl);
    const normalizedSourceUrl = this._normalizeServerRelativeUrl(params.page.serverRelativeUrl);
    const normalizedDestinationFolderUrl = this._normalizeServerRelativeUrl(params.destinationFolderUrl);
    const destinationFileUrl = `${normalizedDestinationFolderUrl}/${params.page.fileName}`;

    const selectedFields = Array.from(
      new Set(params.selectedFieldInternalNames.map((name) => name.trim()).filter(Boolean))
    );

    let sourceValues: Record<string, unknown> = {};
    if (selectedFields.length > 0) {
      const listItemId = params.page.listItemId ??
        await this._resolveListItemId(normalizedSourceUrl);

      sourceValues = await this._getSourceFieldValues(
        params.sourceLibraryServerRelativeUrl,
        listItemId,
        selectedFields
      );
    }

    await this._sourceSp.web
      .getFileByServerRelativePath(normalizedSourceUrl)
      .copyByPath(destinationFileUrl, true);

    if (selectedFields.length > 0) {
      const updatePayload = this._buildUpdatePayload(sourceValues, selectedFields);
      if (Object.keys(updatePayload).length > 0) {
        const destinationItem = await destinationSp.web
          .getFileByServerRelativePath(destinationFileUrl)
          .getItem();
        await destinationItem.update(updatePayload);
      }
    }

    try {
      await this._sourceSp.web.getFileByServerRelativePath(normalizedSourceUrl).recycle();
    } catch {
      throw new Error(strings.CrossSiteDeleteFailedError);
    }

    return {
      destinationFileUrl
    };
  }

  private async _loadFolderTree(
    libraryServerRelativeUrl: string,
    webAbsoluteUrl?: string
  ): Promise<IFolderNode[]> {
    const sp = webAbsoluteUrl ? this._getSpForWeb(webAbsoluteUrl) : this._sourceSp;
    return this._loadChildFolders(sp, libraryServerRelativeUrl, 0);
  }

  private async _loadChildFolders(
    sp: SPFI,
    parentFolderUrl: string,
    depth: number
  ): Promise<IFolderNode[]> {
    const folders: IFolderInfo[] = await sp.web
      .getFolderByServerRelativePath(this._normalizeServerRelativeUrl(parentFolderUrl))
      .folders();

    const eligibleFolders: IFolderInfo[] = folders
      .filter((folder: IFolderInfo) => this._isEligibleFolder(folder.Name, depth))
      .sort((left: IFolderInfo, right: IFolderInfo) => left.Name.localeCompare(right.Name));

    const childNodes: IFolderNode[] = [];

    for (const folder of eligibleFolders) {
      let children: IFolderNode[] = [];

      try {
        children = await this._loadChildFolders(sp, folder.ServerRelativeUrl, depth + 1);
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

  private async _getListFields(sp: SPFI, libraryServerRelativeUrl: string): Promise<IFieldInfo[]> {
    return sp.web.getList(this._normalizeServerRelativeUrl(libraryServerRelativeUrl)).fields();
  }

  private async _resolveSitePagesLibraryUrl(sp: SPFI): Promise<string> {
    const web = await sp.web.select('ServerRelativeUrl')();
    const libraryServerRelativeUrl = `${this._normalizeServerRelativeUrl(web.ServerRelativeUrl)}/SitePages`;

    try {
      await sp.web.getFolderByServerRelativePath(libraryServerRelativeUrl).select('Name')();
      return libraryServerRelativeUrl;
    } catch {
      throw new Error(strings.SitePagesLibraryMissingError);
    }
  }

  private async _resolveListItemId(pageServerRelativeUrl: string): Promise<number> {
    const item = await this._sourceSp.web
      .getFileByServerRelativePath(pageServerRelativeUrl)
      .getItem<{ Id: number }>('Id');

    if (!item?.Id || !Number.isFinite(item.Id)) {
      throw new Error(strings.MovePageError);
    }

    return item.Id;
  }

  private async _getSourceFieldValues(
    sourceLibraryServerRelativeUrl: string,
    listItemId: number,
    fieldInternalNames: string[]
  ): Promise<Record<string, unknown>> {
    const selectFields = Array.from(new Set(['Id', ...fieldInternalNames]));
    const item = await this._sourceSp.web
      .getList(this._normalizeServerRelativeUrl(sourceLibraryServerRelativeUrl))
      .items
      .getById(listItemId)
      .select(...selectFields)();

    return item as Record<string, unknown>;
  }

  private _buildUpdatePayload(
    sourceValues: Record<string, unknown>,
    selectedFieldInternalNames: string[]
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const internalName of selectedFieldInternalNames) {
      if (!(internalName in sourceValues)) {
        continue;
      }

      const value = sourceValues[internalName];
      if (value === undefined) {
        continue;
      }

      payload[internalName] = value;
    }

    return payload;
  }

  private _isEligibleMetadataField(field: IFieldInfo): boolean {
    const internalName = (field.InternalName || '').trim();
    if (!internalName) {
      return false;
    }

    const normalizedInternalName = internalName.toLowerCase();
    if (normalizedInternalName.startsWith('_')) {
      return false;
    }

    if (field.Hidden || field.ReadOnlyField) {
      return false;
    }

    if (EXCLUDED_FIELD_INTERNAL_NAMES.has(normalizedInternalName)) {
      return false;
    }

    const typeAsString = (field.TypeAsString || '').trim().toLowerCase();
    if (!typeAsString || EXCLUDED_FIELD_TYPES.has(typeAsString)) {
      return false;
    }

    return true;
  }

  private _getSpForWeb(webAbsoluteUrl: string): SPFI {
    return spfi(this._normalizeAbsoluteUrl(webAbsoluteUrl)).using(SPFx(this._context));
  }

  private _folderCacheKey(libraryServerRelativeUrl: string, webAbsoluteUrl?: string): string {
    const webKey = webAbsoluteUrl
      ? this._normalizeAbsoluteUrl(webAbsoluteUrl).toLowerCase()
      : 'current';
    return `${webKey}|${libraryServerRelativeUrl.toLowerCase()}`;
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

  private _normalizeAbsoluteUrl(absoluteUrl: string): string {
    return absoluteUrl.trim().replace(/\/+$/, '');
  }

  private _normalizeServerRelativeUrl(serverRelativeUrl: string): string {
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
}
