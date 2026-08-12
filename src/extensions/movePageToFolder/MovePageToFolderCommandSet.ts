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
import type { ISelectedPageInfo } from './types';
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
    const selectedPages = this._getSelectedPages();

    if (!this._isSitePagesLibrary(libraryServerRelativeUrl) || selectedPages.length === 0) {
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

    const folderService = this._getFolderService(libraryServerRelativeUrl);
    if (folderService.getCachedFolderTree() !== undefined) {
      return;
    }

    const requestId = ++this._folderLoadRequestId;

    folderService
      .getFolderTree()
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
    const selectedPages = this._getSelectedPages();
    const currentSiteAbsoluteUrl = this.context.pageContext.web.absoluteUrl;

    if (!libraryServerRelativeUrl || !this._isSitePagesLibrary(libraryServerRelativeUrl) || selectedPages.length === 0) {
      return;
    }

    const folderService = this._getFolderService(libraryServerRelativeUrl, currentSiteAbsoluteUrl);

    const dialog = new MovePageToFolderDialog({
      currentSiteAbsoluteUrl,
      libraryServerRelativeUrl: folderService.libraryServerRelativeUrl,
      loadFolders: async (siteAbsoluteUrl: string) => {
        const normalizedRequestedSite = this._normalizeAbsoluteUrl(siteAbsoluteUrl);
        const normalizedCurrentSite = this._normalizeAbsoluteUrl(currentSiteAbsoluteUrl);

        if (normalizedRequestedSite === normalizedCurrentSite) {
          const currentService = this._getFolderService(
            libraryServerRelativeUrl,
            currentSiteAbsoluteUrl
          );
          const folders = await currentService.getFolderTree();

          return {
            folders,
            libraryServerRelativeUrl: currentService.libraryServerRelativeUrl,
            webAbsoluteUrl: currentService.webAbsoluteUrl
          };
        }

        return SitePagesFolderService.loadFoldersForSite(this.context, siteAbsoluteUrl);
      },
      onMove: async (
        destinationFolderUrl: string,
        siteAbsoluteUrl: string,
        onProgress?: (fileName: string) => void
      ) => {
        const destinationService = await SitePagesFolderService.createForSite(
          this.context,
          siteAbsoluteUrl
        );
        const moveResult = await destinationService.movePages(
          selectedPages.map((selectedPage) => selectedPage.serverRelativeUrl),
          destinationFolderUrl,
          currentSiteAbsoluteUrl,
          (fileName: string) => {
            onProgress?.(fileName);
          }
        );

        if (moveResult.failures.length > 0) {
          const failedDetails = moveResult.failures
            .map((failure) => failure.message
              ? `${failure.fileName} (${failure.message})`
              : failure.fileName)
            .join('; ');
          const message = strings.MovePagesPartialError
            .replace('{0}', String(moveResult.movedCount))
            .replace('{1}', String(selectedPages.length))
            .replace('{2}', failedDetails);

          if (moveResult.movedCount === 0) {
            // Prefer the concrete SharePoint / fallback reason for a total failure.
            const firstFailureMessage = moveResult.failures[0]?.message?.trim();
            throw new Error(firstFailureMessage || message);
          }

          Log.warn(LOG_SOURCE, message);
          return message;
        }

        return undefined;
      },
      pages: selectedPages
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

  private _getFolderService(
    libraryServerRelativeUrl: string,
    webAbsoluteUrl?: string
  ): SitePagesFolderService {
    const normalizedLibraryUrl = this._normalizeServerRelativeUrl(libraryServerRelativeUrl);
    const normalizedWebUrl = this._normalizeAbsoluteUrl(
      webAbsoluteUrl ?? this.context.pageContext.web.absoluteUrl
    );

    if (
      !this._folderService ||
      this._folderService.libraryServerRelativeUrl !== normalizedLibraryUrl ||
      this._folderService.webAbsoluteUrl.toLowerCase() !== normalizedWebUrl
    ) {
      this._folderService = new SitePagesFolderService(
        this.context,
        normalizedLibraryUrl,
        normalizedWebUrl
      );
    }

    return this._folderService;
  }

  private _getSelectedPages(): ISelectedPageInfo[] {
    const selectedRows = this.context.listView.selectedRows;
    if (!selectedRows || selectedRows.length === 0) {
      return [];
    }

    const selectedPages: ISelectedPageInfo[] = [];

    for (const selectedRow of selectedRows) {
      const page = this._tryGetPageFromRow(selectedRow);
      if (!page) {
        // Mixed selection (folders / non-pages) — require every row to be a movable page.
        return [];
      }

      selectedPages.push(page);
    }

    return selectedPages;
  }

  private _tryGetPageFromRow(selectedRow: RowAccessor): ISelectedPageInfo | undefined {
    const fileName = this._getStringFieldValue(selectedRow, 'FileLeafRef');
    const fileServerRelativeUrl = this._normalizeServerRelativeUrl(
      this._getStringFieldValue(selectedRow, 'FileRef')
    );
    const objectType = this._getStringFieldValue(selectedRow, 'FSObjType') ??
      this._getStringFieldValue(selectedRow, 'FileSystemObjectType');

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

  private _getCurrentLibraryServerRelativeUrl(): string | undefined {
    return this.context.listView.list?.serverRelativeUrl ?? this.context.pageContext.list?.serverRelativeUrl;
  }

  private _isSitePagesLibrary(serverRelativeUrl: string | undefined): boolean {
    if (!serverRelativeUrl) {
      return false;
    }

    return this._normalizeServerRelativeUrl(serverRelativeUrl).toLowerCase().endsWith(SITE_PAGES_SEGMENT);
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

  private _normalizeAbsoluteUrl(absoluteUrl: string): string {
    try {
      const parsed = new URL(absoluteUrl.trim());
      const path = this._normalizeServerRelativeUrl(parsed.pathname) || '/';
      const origin = parsed.protocol === 'http:'
        ? `https://${parsed.host}`
        : parsed.origin;
      const normalized = path === '/' ? origin : `${origin}${path}`;
      return normalized.toLowerCase();
    } catch {
      return absoluteUrl.trim().toLowerCase();
    }
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
