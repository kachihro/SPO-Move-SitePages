import { Log } from '@microsoft/sp-core-library';
import {
  BaseListViewCommandSet,
  type Command,
  type IListViewCommandSetExecuteEventParameters,
  type ListViewStateChangedEventArgs,
  type RowAccessor
} from '@microsoft/sp-listview-extensibility';

import MovePageToFolderDialog from './dialogs/MovePageToFolderDialog';
import SitePagesFolderService from './services/SitePagesFolderService';
import SiteSearchService from './services/SiteSearchService';
import type { IMoveRequest, ISelectedPageInfo } from './types';
import * as strings from 'MovePageToFolderCommandSetStrings';

export interface IMovePageToFolderCommandSetProperties {
}

const LOG_SOURCE: string = 'MovePageToFolderCommandSet';
const MOVE_TO_FOLDER_COMMAND_ID: string = 'MOVE_TO_FOLDER';
const SITE_PAGES_SEGMENT: string = '/sitepages';
const TEMPLATES_SEGMENT: string = '/sitepages/templates/';

export default class MovePageToFolderCommandSet extends BaseListViewCommandSet<IMovePageToFolderCommandSetProperties> {
  private _activeDialog: MovePageToFolderDialog | undefined;
  private _folderLoadRequestId: number = 0;
  private _folderService: SitePagesFolderService | undefined;
  private _siteSearchService: SiteSearchService | undefined;

  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, 'Initialized MovePageToFolderCommandSet');

    const moveToFolderCommand: Command | undefined = this.tryGetCommand(MOVE_TO_FOLDER_COMMAND_ID);
    if (moveToFolderCommand) {
      moveToFolderCommand.title = strings.MoveToFolderCommand;
      moveToFolderCommand.visible = false;
    }

    this.context.listView.listViewStateChangedEvent.add(this, this._onListViewStateChanged);
    this._updateCommandVisibility();

    return Promise.resolve();
  }

  protected onDispose(): void {
    this.context.listView.listViewStateChangedEvent.remove(this, this._onListViewStateChanged);

    if (this._activeDialog) {
      this._activeDialog.close().catch(() => undefined);
      this._activeDialog = undefined;
    }

    super.onDispose();
  }

  public onExecute(event: IListViewCommandSetExecuteEventParameters): void {
    if (event.itemId === MOVE_TO_FOLDER_COMMAND_ID) {
      this._openMoveDialog().catch((error: unknown) => {
        Log.error(LOG_SOURCE, this._toError(error, strings.MovePageError));
      });
      return;
    }

    throw new Error(`Unknown command: ${event.itemId}`);
  }

  private _onListViewStateChanged = (_args: ListViewStateChangedEventArgs): void => {
    this._updateCommandVisibility();
  };

  private _updateCommandVisibility(): void {
    const moveToFolderCommand: Command | undefined = this.tryGetCommand(MOVE_TO_FOLDER_COMMAND_ID);
    if (!moveToFolderCommand) {
      return;
    }

    moveToFolderCommand.title = strings.MoveToFolderCommand;

    const libraryServerRelativeUrl = this._getCurrentLibraryServerRelativeUrl();
    const selectedPage = this._getSelectedPage();

    if (!this._isSitePagesLibrary(libraryServerRelativeUrl) || !selectedPage) {
      if (moveToFolderCommand.visible) {
        moveToFolderCommand.visible = false;
        this.raiseOnChange();
      }

      return;
    }

    if (!moveToFolderCommand.visible) {
      moveToFolderCommand.visible = true;
      this.raiseOnChange();
    }

    if (!libraryServerRelativeUrl) {
      return;
    }

    const folderService = this._getFolderService();
    const normalizedLibraryUrl = this._normalizeServerRelativeUrl(libraryServerRelativeUrl);
    if (folderService.getCachedFolderTree(normalizedLibraryUrl) !== undefined) {
      return;
    }

    const requestId = ++this._folderLoadRequestId;
    const currentWebAbsoluteUrl = this.context.pageContext.web.absoluteUrl;

    folderService
      .getFolderTree(normalizedLibraryUrl, currentWebAbsoluteUrl)
      .catch((error: unknown) => {
        if (this.isDisposed || requestId !== this._folderLoadRequestId) {
          return;
        }

        Log.error(LOG_SOURCE, this._toError(error, strings.LoadFoldersError));
      });
  }

  private async _openMoveDialog(): Promise<void> {
    if (this._activeDialog) {
      return;
    }

    const libraryServerRelativeUrl = this._getCurrentLibraryServerRelativeUrl();
    const selectedPage = this._getSelectedPage();

    if (!libraryServerRelativeUrl || !this._isSitePagesLibrary(libraryServerRelativeUrl) || !selectedPage) {
      return;
    }

    const folderService = this._getFolderService();
    const siteSearchService = this._getSiteSearchService();
    const normalizedLibraryUrl = this._normalizeServerRelativeUrl(libraryServerRelativeUrl);
    const currentWebAbsoluteUrl = this.context.pageContext.web.absoluteUrl;

    const dialog = new MovePageToFolderDialog({
      currentLibraryServerRelativeUrl: normalizedLibraryUrl,
      currentWebAbsoluteUrl,
      loadFolders: async (webAbsoluteUrl: string, destinationLibraryUrl: string) => {
        return folderService.getFolderTree(destinationLibraryUrl, webAbsoluteUrl);
      },
      loadMatchingFields: async (destinationWebAbsoluteUrl: string) => {
        return folderService.getMatchingMetadataFields(normalizedLibraryUrl, destinationWebAbsoluteUrl);
      },
      onMove: async (request: IMoveRequest) => {
        const isSameSite = this._normalizeAbsoluteUrl(request.destinationWebAbsoluteUrl).toLowerCase() ===
          this._normalizeAbsoluteUrl(currentWebAbsoluteUrl).toLowerCase();

        if (isSameSite) {
          await folderService.movePageSameSite(
            selectedPage.serverRelativeUrl,
            request.destinationFolderUrl
          );
          return;
        }

        await folderService.movePageCrossSite({
          destinationFolderUrl: request.destinationFolderUrl,
          destinationWebAbsoluteUrl: request.destinationWebAbsoluteUrl,
          page: selectedPage,
          selectedFieldInternalNames: request.selectedFieldInternalNames,
          sourceLibraryServerRelativeUrl: normalizedLibraryUrl
        });
      },
      page: selectedPage,
      resolveSitePagesLibraryUrl: async (webAbsoluteUrl: string) => {
        return siteSearchService.resolveSitePagesLibraryUrl(webAbsoluteUrl);
      },
      searchSites: async (query: string) => {
        return siteSearchService.searchSites(query);
      }
    });

    this._activeDialog = dialog;

    try {
      await dialog.show();

      if (dialog.didMove && !this.isDisposed) {
        window.location.reload();
      }
    } finally {
      if (this._activeDialog === dialog) {
        this._activeDialog = undefined;
      }
    }
  }

  private _getFolderService(): SitePagesFolderService {
    if (!this._folderService) {
      this._folderService = new SitePagesFolderService(this.context);
    }

    return this._folderService;
  }

  private _getSiteSearchService(): SiteSearchService {
    if (!this._siteSearchService) {
      this._siteSearchService = new SiteSearchService(this.context);
    }

    return this._siteSearchService;
  }

  private _getSelectedPage(): ISelectedPageInfo | undefined {
    const selectedRow = this.context.listView.selectedRows?.[0];

    if (!selectedRow) {
      return undefined;
    }

    const fileName = this._getStringFieldValue(selectedRow, 'FileLeafRef');
    const fileServerRelativeUrl = this._normalizeServerRelativeUrl(
      this._getStringFieldValue(selectedRow, 'FileRef')
    );
    const objectType = this._getStringFieldValue(selectedRow, 'FSObjType') ??
      this._getStringFieldValue(selectedRow, 'FileSystemObjectType');
    const listItemId = this._getNumberFieldValue(selectedRow, 'ID') ??
      this._getNumberFieldValue(selectedRow, 'Id');

    if (!fileName || !fileServerRelativeUrl) {
      return undefined;
    }

    if (objectType === '1') {
      return undefined;
    }

    if (!fileName.toLowerCase().endsWith('.aspx')) {
      return undefined;
    }

    if (fileServerRelativeUrl.toLowerCase().includes(TEMPLATES_SEGMENT)) {
      return undefined;
    }

    const lastSlashIndex = fileServerRelativeUrl.lastIndexOf('/');
    if (lastSlashIndex < 0) {
      return undefined;
    }

    return {
      currentFolderUrl: fileServerRelativeUrl.substring(0, lastSlashIndex) || '/',
      fileName,
      listItemId,
      serverRelativeUrl: fileServerRelativeUrl
    };
  }

  private _getStringFieldValue(row: RowAccessor, internalName: string): string | undefined {
    const value = row.getValueByName(internalName);

    if (value === undefined || value === null) {
      return undefined;
    }

    return String(value);
  }

  private _getNumberFieldValue(row: RowAccessor, internalName: string): number | undefined {
    const value = row.getValueByName(internalName);

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsedValue = Number(value);
      if (Number.isFinite(parsedValue)) {
        return parsedValue;
      }
    }

    return undefined;
  }

  private _getCurrentLibraryServerRelativeUrl(): string | undefined {
    return this.context.listView.list?.serverRelativeUrl ?? this.context.pageContext.list?.serverRelativeUrl;
  }

  private _isSitePagesLibrary(serverRelativeUrl: string | undefined): boolean {
    if (!serverRelativeUrl) {
      return false;
    }

    return this._normalizeServerRelativeUrl(serverRelativeUrl).toLowerCase().endsWith(SITE_PAGES_SEGMENT);
  }

  private _normalizeAbsoluteUrl(absoluteUrl: string): string {
    return absoluteUrl.trim().replace(/\/+$/, '');
  }

  private _normalizeServerRelativeUrl(serverRelativeUrl: string | undefined): string {
    if (!serverRelativeUrl) {
      return '';
    }

    const trimmedValue = serverRelativeUrl.trim();
    if (!trimmedValue) {
      return '';
    }

    const withLeadingSlash = trimmedValue.startsWith('/')
      ? trimmedValue
      : `/${trimmedValue}`;
    const normalizedValue = withLeadingSlash.replace(/\/+$/, '');

    return normalizedValue || '/';
  }

  private _toError(error: unknown, fallbackMessage: string): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string' && error.trim()) {
      return new Error(error);
    }

    return new Error(fallbackMessage);
  }
}
