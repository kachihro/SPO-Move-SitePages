import {
  Button,
  FluentProvider,
  Input,
  Label,
  SearchBox,
  Spinner,
  Tree,
  TreeItem,
  TreeItemLayout,
  makeStyles,
  mergeClasses,
  webLightTheme
} from '@fluentui/react-components';
import type { TreeOpenChangeData, TreeOpenChangeEvent } from '@fluentui/react-components';
import { FolderOpenRegular, FolderRegular } from '@fluentui/react-icons';
import { BaseDialog } from '@microsoft/sp-dialog';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import * as strings from 'MovePageToFolderCommandSetStrings';
import type { IFolderNode, ILoadFoldersResult, ISelectedPageInfo } from '../types';

const useStyles = makeStyles({
  provider: {
    backgroundColor: '#ffffff'
  },
  root: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '24px 24px 20px',
    width: 'min(900px, calc(100vw - 32px))'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    lineHeight: '32px'
  },
  summaryCard: {
    backgroundColor: '#fafafa',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px 18px'
  },
  label: {
    color: '#616161',
    fontSize: '12px',
    letterSpacing: '0.04em',
    lineHeight: '16px',
    marginBottom: '6px',
    textTransform: 'uppercase'
  },
  value: {
    fontSize: '14px',
    lineHeight: '20px',
    wordBreak: 'break-word'
  },
  folderPicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  sitePicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  siteRow: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  siteInput: {
    flex: '1 1 280px',
    minWidth: '200px'
  },
  searchBox: {
    width: '100%',
    maxWidth: '100%'
  },
  treeContainer: {
    backgroundColor: '#ffffff',
    border: '1px solid #d1d1d1',
    borderRadius: '10px',
    height: '380px',
    overflowY: 'auto',
    padding: '12px 16px'
  },
  treeRoot: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  subtree: {
    borderLeft: '1px solid #e3e6ea',
    marginLeft: '14px',
    paddingLeft: '14px'
  },
  treeItem: {
    alignItems: 'center',
    borderRadius: '8px',
    cursor: 'pointer',
    minHeight: '36px',
    paddingLeft: '6px',
    paddingRight: '8px',
    ':hover': {
      backgroundColor: '#f7f9fb'
    }
  },
  treeItemRoot: {
    fontWeight: '600'
  },
  treeItemSelected: {
    backgroundColor: '#e8f2ff',
    boxShadow: 'rgb(20, 20, 20) 0px 0.5px 4px 0px',
    color: '#0f6cbd',
    fontWeight: '600'
  },
  expandIconSpacer: {
    display: 'inline-block',
    flexShrink: 0,
    minWidth: '24px'
  },
  nodeContent: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: '8px',
    minWidth: 0
  },
  folderIcon: {
    color: '#0f6cbd',
    flexShrink: 0
  },
  folderIconRoot: {
    color: '#0a7f8c'
  },
  nodeText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  emptyState: {
    alignItems: 'center',
    color: '#616161',
    display: 'flex',
    minHeight: '64px'
  },
  loadingState: {
    alignItems: 'center',
    display: 'flex',
    height: '100%',
    justifyContent: 'center'
  },
  errorMessage: {
    backgroundColor: '#fff4f4',
    border: '1px solid #f1c7c9',
    borderRadius: '6px',
    color: '#a4262c',
    padding: '12px 14px'
  },
  footer: {
    alignItems: 'center',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    gap: '16px',
    justifyContent: 'space-between',
    paddingTop: '4px'
  },
  movingStatus: {
    alignItems: 'center',
    color: '#616161',
    display: 'flex',
    flex: '1 1 auto',
    fontSize: '13px',
    gap: '8px',
    lineHeight: '18px',
    minWidth: 0
  },
  movingStatusText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  buttonRow: {
    display: 'flex',
    flexShrink: 0,
    gap: '8px',
    justifyContent: 'flex-end'
  }
});

export interface IMovePageToFolderDialogProps {
  currentSiteAbsoluteUrl: string;
  libraryServerRelativeUrl: string;
  loadFolders: (siteAbsoluteUrl: string) => Promise<ILoadFoldersResult>;
  onMove: (
    destinationFolderUrl: string,
    siteAbsoluteUrl: string,
    onProgress?: (fileName: string) => void
  ) => Promise<string | undefined>;
  pages: ISelectedPageInfo[];
}

interface IMovePageToFolderDialogContentProps extends IMovePageToFolderDialogProps {
  onDismiss: () => Promise<void>;
}

interface IFolderTreeNodeProps {
  classes: ReturnType<typeof useStyles>;
  level: number;
  node: IFolderNode;
  onSelect: (folderUrl: string) => void;
  selectedFolderUrl: string | undefined;
}

interface ISiteLoadRequest {
  nonce: number;
  url: string;
}

function FolderTreeNode(props: IFolderTreeNodeProps): React.ReactElement {
  const { classes, level, node, onSelect, selectedFolderUrl } = props;
  const isSelected = selectedFolderUrl === node.serverRelativeUrl;
  const isRoot = level === 0;
  const isLeaf = node.children.length === 0;

  const handleSelect = (
    event: React.KeyboardEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
  ): void => {
    const eventTarget = event.target as HTMLElement | null;

    // Expand chevron lives inside TreeItemLayout; do not intercept those clicks.
    // Leaf rows use a spacer in the same slot — still allow selection there.
    if (!isLeaf && eventTarget?.closest('.fui-TreeItemLayout__expandIcon')) {
      return;
    }

    const currentTarget = event.currentTarget;

    // Select on the row content only; prevent Fluent from also toggling expand on row click.
    event.preventDefault();
    event.stopPropagation();
    onSelect(node.serverRelativeUrl);

    if (event.type === 'click') {
      const treeItemElement = currentTarget.closest('[role="treeitem"]') as HTMLElement | null;

      window.requestAnimationFrame(() => {
        treeItemElement?.blur();
      });
    }
  };

  const icon = isRoot || !isLeaf
    ? (
      <FolderOpenRegular
        className={mergeClasses(classes.folderIcon, isRoot && classes.folderIconRoot)}
      />
    )
    : <FolderRegular className={classes.folderIcon} />;

  const layout = (
    <TreeItemLayout
      aria-selected={isSelected}
      className={mergeClasses(
        classes.treeItem,
        isRoot && classes.treeItemRoot,
        isSelected && classes.treeItemSelected
      )}
      expandIcon={isLeaf
        ? <span aria-hidden={true} className={classes.expandIconSpacer} />
        : undefined}
      iconBefore={icon}
      onClick={handleSelect}
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          handleSelect(event);
        }
      }}
    >
      <span className={classes.nodeContent}>
        <span className={classes.nodeText}>{node.name}</span>
      </span>
    </TreeItemLayout>
  );

  if (isLeaf) {
    return (
      <TreeItem itemType="leaf" value={node.serverRelativeUrl}>
        {layout}
      </TreeItem>
    );
  }

  return (
    <TreeItem itemType="branch" value={node.serverRelativeUrl}>
      {layout}
      <Tree aria-label={node.name} className={classes.subtree}>
        {node.children.map((childNode: IFolderNode) => (
          <FolderTreeNode
            classes={classes}
            key={childNode.serverRelativeUrl}
            level={level + 1}
            node={childNode}
            onSelect={onSelect}
            selectedFolderUrl={selectedFolderUrl}
          />
        ))}
      </Tree>
    </TreeItem>
  );
}

function MovePageToFolderDialogContent(
  props: IMovePageToFolderDialogContentProps
): React.ReactElement {
  const {
    currentSiteAbsoluteUrl,
    libraryServerRelativeUrl,
    loadFolders,
    onDismiss,
    onMove,
    pages
  } = props;
  const classes = useStyles();
  const isMultiplePages = pages.length > 1;
  const sharedCurrentFolderUrl = React.useMemo(() => {
    if (pages.length === 0) {
      return libraryServerRelativeUrl;
    }

    const firstFolderUrl = pages[0].currentFolderUrl;
    return pages.every((selectedPage) => selectedPage.currentFolderUrl === firstFolderUrl)
      ? firstFolderUrl
      : libraryServerRelativeUrl;
  }, [libraryServerRelativeUrl, pages]);
  const dialogTitle = isMultiplePages
    ? `${strings.DialogTitleMultiple} - ${strings.SelectedPagesCountLabel.replace('{0}', String(pages.length))}`
    : `${strings.DialogTitle} - ${pages[0]?.fileName ?? ''}`.trim();
  const selectedPagesSummary = isMultiplePages
    ? pages.map((selectedPage) => selectedPage.fileName).join(', ')
    : undefined;
  const [siteUrlDraft, setSiteUrlDraft] = React.useState<string>(currentSiteAbsoluteUrl);
  const [siteLoadRequest, setSiteLoadRequest] = React.useState<ISiteLoadRequest | undefined>(
    undefined
  );
  const [loadedSiteAbsoluteUrl, setLoadedSiteAbsoluteUrl] = React.useState<string | undefined>(
    undefined
  );
  const [activeLibraryServerRelativeUrl, setActiveLibraryServerRelativeUrl] = React.useState<string>(
    libraryServerRelativeUrl
  );
  const normalizedLibraryUrl = React.useMemo(
    () => normalizeServerRelativeUrl(activeLibraryServerRelativeUrl),
    [activeLibraryServerRelativeUrl]
  );
  const [folders, setFolders] = React.useState<IFolderNode[] | undefined>(undefined);
  const [isLoadingFolders, setIsLoadingFolders] = React.useState<boolean>(false);
  const [loadError, setLoadError] = React.useState<string | undefined>(undefined);
  const [selectedFolderUrl, setSelectedFolderUrl] = React.useState<string | undefined>(undefined);
  const [isMoving, setIsMoving] = React.useState<boolean>(false);
  const [movingPageName, setMovingPageName] = React.useState<string | undefined>(undefined);
  const [moveError, setMoveError] = React.useState<string | undefined>(undefined);
  const [showSameFolderMessage, setShowSameFolderMessage] = React.useState<boolean>(false);
  const [folderSearchQuery, setFolderSearchQuery] = React.useState<string>('');
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!siteLoadRequest) {
      return;
    }

    let isMounted = true;

    const run = async (): Promise<void> => {
      setIsLoadingFolders(true);
      setLoadError(undefined);

      try {
        const result = await loadFolders(siteLoadRequest.url);

        if (!isMounted) {
          return;
        }

        setFolders(result.folders);
        setActiveLibraryServerRelativeUrl(result.libraryServerRelativeUrl);
        setLoadedSiteAbsoluteUrl(result.webAbsoluteUrl);
        setSiteUrlDraft(result.webAbsoluteUrl);
        setSelectedFolderUrl(undefined);
        setShowSameFolderMessage(false);
        setMoveError(undefined);
        setFolderSearchQuery('');
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        setFolders(undefined);
        setLoadedSiteAbsoluteUrl(undefined);
        setLoadError(getSiteLoadErrorMessage(
          error,
          normalizeAbsoluteUrl(siteLoadRequest.url) ===
            normalizeAbsoluteUrl(currentSiteAbsoluteUrl)
            ? strings.LoadFoldersError
            : strings.LoadSiteError
        ));
      }

      if (isMounted) {
        setIsLoadingFolders(false);
      }
    };

    run().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [currentSiteAbsoluteUrl, loadFolders, siteLoadRequest]);

  const folderTreeRoot = React.useMemo<IFolderNode | undefined>(() => {
    if (folders === undefined) {
      return undefined;
    }

    return {
      children: folders,
      name: strings.SitePagesRootLabel,
      serverRelativeUrl: normalizedLibraryUrl
    };
  }, [folders, normalizedLibraryUrl]);

  const filteredFolderTreeRoot = React.useMemo<IFolderNode | undefined>(() => {
    if (!folderTreeRoot) {
      return undefined;
    }

    const trimmedQuery = folderSearchQuery.trim();
    if (!trimmedQuery) {
      return folderTreeRoot;
    }

    return filterFolderTree(folderTreeRoot, trimmedQuery) ?? {
      ...folderTreeRoot,
      children: []
    };
  }, [folderSearchQuery, folderTreeRoot]);

  const hasSearchQuery = folderSearchQuery.trim().length > 0;
  const hasMatchingFolders = Boolean(
    filteredFolderTreeRoot &&
    (filteredFolderTreeRoot.children.length > 0 ||
      filteredFolderTreeRoot.name.toLowerCase().includes(folderSearchQuery.trim().toLowerCase()))
  );

  const trimmedSearchQuery = folderSearchQuery.trim();
  const isSameSite = Boolean(
    loadedSiteAbsoluteUrl &&
    normalizeAbsoluteUrl(loadedSiteAbsoluteUrl) === normalizeAbsoluteUrl(currentSiteAbsoluteUrl)
  );

  React.useEffect(() => {
    if (!folderTreeRoot) {
      return;
    }

    // Only re-sync when the tree loads or the search query changes.
    // Do not depend on openItems updates from expand/collapse.
    if (trimmedSearchQuery) {
      const filteredRoot = filterFolderTree(folderTreeRoot, trimmedSearchQuery) ?? {
        ...folderTreeRoot,
        children: []
      };
      setOpenItems(collectBranchFolderUrls(filteredRoot));
      return;
    }

    setOpenItems(
      collectDefaultOpenFolderUrls(
        folderTreeRoot.serverRelativeUrl,
        isSameSite ? sharedCurrentFolderUrl : folderTreeRoot.serverRelativeUrl
      )
    );
  }, [folderTreeRoot, isSameSite, sharedCurrentFolderUrl, trimmedSearchQuery]);

  const selectedFolderLabel = selectedFolderUrl
    ? formatFolderLabel(selectedFolderUrl, activeLibraryServerRelativeUrl)
    : strings.NoFolderSelectedLabel;
  const isSameFolder = isSameSite &&
    Boolean(selectedFolderUrl) &&
    pages.length > 0 &&
    pages.every((selectedPage) => selectedPage.currentFolderUrl === selectedFolderUrl);
  const canMove = Boolean(selectedFolderUrl) &&
    Boolean(loadedSiteAbsoluteUrl) &&
    !isMoving &&
    !isLoadingFolders &&
    !loadError;

  const handleFolderSelect = (folderUrl: string): void => {
    setSelectedFolderUrl(folderUrl);
    setShowSameFolderMessage(false);
    setMoveError(undefined);
  };

  const handleDismissClick = (): void => {
    if (!isMoving) {
      onDismiss().catch(() => undefined);
    }
  };

  const handleLoadSiteClick = (): void => {
    if (isMoving || isLoadingFolders) {
      return;
    }

    const trimmedSiteUrl = siteUrlDraft.trim();
    if (!isValidHttpsSiteUrl(trimmedSiteUrl)) {
      setLoadError(strings.InvalidSiteUrlMessage);
      setFolders(undefined);
      setLoadedSiteAbsoluteUrl(undefined);
      setSelectedFolderUrl(undefined);
      return;
    }

    setSiteLoadRequest((previous: ISiteLoadRequest | undefined) => ({
      nonce: (previous?.nonce ?? 0) + 1,
      url: trimmedSiteUrl
    }));
  };

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!isMoving) {
        onDismiss().catch(() => undefined);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMoving, onDismiss]);

  const handleMoveClick = async (): Promise<void> => {
    if (!selectedFolderUrl || !loadedSiteAbsoluteUrl || isMoving || isLoadingFolders || loadError) {
      return;
    }

    if (isSameFolder) {
      setMoveError(undefined);
      setShowSameFolderMessage(true);
      return;
    }

    setShowSameFolderMessage(false);
    setMoveError(undefined);
    setMovingPageName(pages[0]?.fileName);
    setIsMoving(true);

    try {
      const warningMessage = await onMove(
        selectedFolderUrl,
        loadedSiteAbsoluteUrl,
        (fileName: string) => {
          setMovingPageName(fileName);
        }
      );
      setIsMoving(false);
      setMovingPageName(undefined);

      if (warningMessage) {
        setMoveError(warningMessage);
        return;
      }

      await onDismiss();
      return;
    } catch (error: unknown) {
      setMoveError(getErrorMessage(
        error,
        isSameSite ? strings.MovePageError : strings.CrossSiteMoveError
      ));
    }

    setIsMoving(false);
    setMovingPageName(undefined);
  };

  const handleOpenChange = (_event: TreeOpenChangeEvent, data: TreeOpenChangeData): void => {
    setOpenItems(Array.from(data.openItems, (itemValue) => String(itemValue)));
  };

  let treeContent: React.ReactNode;

  if (isLoadingFolders) {
    treeContent = (
      <div className={classes.loadingState}>
        <Spinner label={strings.LoadingFoldersLabel} />
      </div>
    );
  } else if (loadError) {
    treeContent = (
      <div className={classes.errorMessage} role="alert">
        {loadError}
      </div>
    );
  } else if (!siteLoadRequest) {
    treeContent = null;
  } else if (filteredFolderTreeRoot && hasMatchingFolders) {
    treeContent = (
      <Tree
        aria-label={strings.AvailableFoldersLabel}
        className={classes.treeRoot}
        onOpenChange={handleOpenChange}
        openItems={openItems}
      >
        <FolderTreeNode
          classes={classes}
          key={`${loadedSiteAbsoluteUrl ?? ''}|${filteredFolderTreeRoot.serverRelativeUrl}`}
          level={0}
          node={filteredFolderTreeRoot}
          onSelect={handleFolderSelect}
          selectedFolderUrl={selectedFolderUrl}
        />
      </Tree>
    );
  } else if (hasSearchQuery) {
    treeContent = (
      <div className={classes.emptyState} role="status">
        {strings.NoMatchingFoldersMessage}
      </div>
    );
  } else {
    treeContent = (
      <div className={classes.emptyState} role="status">
        {strings.EmptyFolderMessage}
      </div>
    );
  }

  const showSearchBox = !isLoadingFolders && !loadError && Boolean(folderTreeRoot);

  return (
    <FluentProvider
      className={classes.provider}
      id="move-page-to-folder-dialog"
      theme={webLightTheme}
    >
      <div className={classes.root}>
        <div className={classes.header}>
          <div className={classes.title}>{dialogTitle}</div>
        </div>

        {selectedPagesSummary ? (
          <div className={classes.summaryCard}>
            <div className={classes.label}>{strings.SelectedPagesLabel}</div>
            <div className={classes.value}>{selectedPagesSummary}</div>
          </div>
        ) : null}

        <div className={classes.sitePicker}>
          <Label htmlFor="move-page-destination-site">{strings.DestinationSiteLabel}</Label>
          <div className={classes.siteRow}>
            <Input
              aria-label={strings.DestinationSiteLabel}
              className={classes.siteInput}
              disabled={isMoving}
              id="move-page-destination-site"
              onChange={(_event, data) => {
                setSiteUrlDraft(data.value);
              }}
              onKeyDown={(event) => {
                // Keep SharePoint list-view shortcuts from stealing Ctrl/Cmd+V and typing.
                event.stopPropagation();

                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleLoadSiteClick();
                }
              }}
              onPaste={(event) => {
                event.stopPropagation();

                const pastedText = event.clipboardData?.getData('text');
                if (pastedText === undefined || pastedText === null) {
                  return;
                }

                // Apply paste ourselves when SharePoint blocks the default clipboard action.
                event.preventDefault();
                const inputElement = event.currentTarget as HTMLInputElement;
                const selectionStart = inputElement.selectionStart ?? siteUrlDraft.length;
                const selectionEnd = inputElement.selectionEnd ?? siteUrlDraft.length;
                setSiteUrlDraft(
                  `${siteUrlDraft.slice(0, selectionStart)}${pastedText}${siteUrlDraft.slice(selectionEnd)}`
                );
              }}
              placeholder={strings.DestinationSitePlaceholder}
              value={siteUrlDraft}
            />
            <Button
              appearance="secondary"
              aria-label={strings.LoadSiteButtonAriaLabel}
              disabled={isMoving || isLoadingFolders}
              onClick={handleLoadSiteClick}
            >
              {isLoadingFolders ? strings.LoadingSiteLabel : strings.LoadSiteButton}
            </Button>
          </div>
        </div>

        <div className={classes.folderPicker}>
          {showSearchBox ? (
            <SearchBox
              aria-label={strings.SearchFoldersPlaceholder}
              className={classes.searchBox}
              onChange={(_event, data) => {
                setFolderSearchQuery(data.value ?? '');
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
              onPaste={(event) => {
                event.stopPropagation();

                const pastedText = event.clipboardData?.getData('text');
                if (pastedText === undefined || pastedText === null) {
                  return;
                }

                event.preventDefault();
                const inputElement = event.currentTarget as HTMLInputElement;
                const selectionStart = inputElement.selectionStart ?? folderSearchQuery.length;
                const selectionEnd = inputElement.selectionEnd ?? folderSearchQuery.length;
                setFolderSearchQuery(
                  `${folderSearchQuery.slice(0, selectionStart)}${pastedText}${folderSearchQuery.slice(selectionEnd)}`
                );
              }}
              placeholder={strings.SearchFoldersPlaceholder}
              value={folderSearchQuery}
            />
          ) : null}

          <div className={classes.treeContainer}>
            {treeContent}
          </div>
        </div>

        <div className={classes.summaryCard}>
          <div className={classes.label}>{strings.SelectedFolderLabel}</div>
          <div className={classes.value}>{selectedFolderLabel}</div>
        </div>

        {showSameFolderMessage ? (
          <div className={classes.errorMessage} role="status">
            {isMultiplePages ? strings.SameFolderMessageMultiple : strings.SameFolderMessage}
          </div>
        ) : null}

        {moveError ? (
          <div className={classes.errorMessage} role="alert">
            {moveError}
          </div>
        ) : null}

        <div className={classes.footer}>
          {isMoving
            ? (
              <div className={classes.movingStatus} role="status" aria-live="polite">
                <Spinner size="tiny" />
                <span className={classes.movingStatusText}>
                  {strings.MovingStatusLabel.replace('{0}', movingPageName || pages[0]?.fileName || '')}
                </span>
              </div>
            )
            : <div />}

          <div className={classes.buttonRow}>
            <Button
              appearance="primary"
              disabled={!canMove}
              onClick={() => {
                handleMoveClick().catch(() => undefined);
              }}
            >
              {isMoving ? strings.MovingButton : strings.MoveButton}
            </Button>
            <Button appearance="secondary" disabled={isMoving} onClick={handleDismissClick}>
              {strings.CancelButton}
            </Button>
          </div>
        </div>
      </div>
    </FluentProvider>
  );
}

export default class MovePageToFolderDialog extends BaseDialog {
  private readonly _props: IMovePageToFolderDialogProps;
  private _didMove: boolean = false;

  public constructor(props: IMovePageToFolderDialogProps) {
    super({ isBlocking: true });
    this._props = props;
  }

  public get didMove(): boolean {
    return this._didMove;
  }

  protected onBeforeOpen(): Promise<void> {
    // SharePoint can hide #o365shellwcssframe and steal focus from dialog inputs.
    // See https://github.com/SharePoint/sp-dev-docs/issues/10310
    const shellFrame = document.getElementById('o365shellwcssframe');
    if (shellFrame) {
      shellFrame.style.display = 'block';
    }

    return new Promise((resolve) => {
      window.setTimeout(() => resolve(), 0);
    });
  }

  protected render(): void {
    this.domElement.style.width = '100%';

    // SPFx hosts an older global Tabster instance than Fluent UI v9 expects.
    // Without this guard, dialog render can throw: Cannot read properties of undefined (reading 'set').
    // See https://github.com/SharePoint/sp-dev-docs/issues/10876
    patchSharePointTabsterInstance();

    ReactDOM.render(
      <MovePageToFolderDialogContent
        currentSiteAbsoluteUrl={this._props.currentSiteAbsoluteUrl}
        libraryServerRelativeUrl={this._props.libraryServerRelativeUrl}
        loadFolders={this._props.loadFolders}
        onDismiss={this._handleDismiss}
        onMove={this._handleMove}
        pages={this._props.pages}
      />,
      this.domElement
    );
  }

  protected onAfterClose(): void {
    ReactDOM.unmountComponentAtNode(this.domElement);
  }

  private _handleDismiss = async (): Promise<void> => {
    await this.close();
  };

  private _handleMove = async (
    destinationFolderUrl: string,
    siteAbsoluteUrl: string,
    onProgress?: (fileName: string) => void
  ): Promise<string | undefined> => {
    const warningMessage = await this._props.onMove(
      destinationFolderUrl,
      siteAbsoluteUrl,
      onProgress
    );
    this._didMove = true;
    return warningMessage;
  };
}

function patchSharePointTabsterInstance(): void {
  const tabsterInstance = (window as Window & {
    __tabsterInstance?: { attrHandlers?: Map<string, unknown> };
  }).__tabsterInstance;

  if (tabsterInstance && !tabsterInstance.attrHandlers) {
    tabsterInstance.attrHandlers = new Map();
  }
}

function formatFolderLabel(folderUrl: string, libraryServerRelativeUrl: string): string {
  const normalizedLibraryUrl = normalizeServerRelativeUrl(libraryServerRelativeUrl);
  const normalizedFolderUrl = normalizeServerRelativeUrl(folderUrl);

  if (normalizedFolderUrl === normalizedLibraryUrl) {
    return strings.SitePagesRootLabel;
  }

  if (normalizedFolderUrl.startsWith(`${normalizedLibraryUrl}/`)) {
    const relativeFolderPath = normalizedFolderUrl.slice(normalizedLibraryUrl.length + 1);
    return `${strings.SitePagesRootLabel} / ${relativeFolderPath.split('/').join(' / ')}`;
  }

  return normalizedFolderUrl;
}

function collectBranchFolderUrls(rootNode: IFolderNode): string[] {
  const branchFolderUrls: string[] = [];

  const visit = (node: IFolderNode): void => {
    if (node.children.length === 0) {
      return;
    }

    branchFolderUrls.push(node.serverRelativeUrl);
    node.children.forEach(visit);
  };

  visit(rootNode);

  return branchFolderUrls;
}

function collectDefaultOpenFolderUrls(
  libraryServerRelativeUrl: string,
  currentFolderUrl: string
): string[] {
  const normalizedLibraryUrl = normalizeServerRelativeUrl(libraryServerRelativeUrl);
  const normalizedCurrentFolderUrl = normalizeServerRelativeUrl(currentFolderUrl);
  const openFolderUrls: string[] = [normalizedLibraryUrl];

  if (
    normalizedCurrentFolderUrl === normalizedLibraryUrl ||
    !normalizedCurrentFolderUrl.startsWith(`${normalizedLibraryUrl}/`)
  ) {
    return openFolderUrls;
  }

  const relativeFolderPath = normalizedCurrentFolderUrl.slice(normalizedLibraryUrl.length + 1);
  const pathSegments = relativeFolderPath.split('/').filter((segment) => segment.length > 0);
  let pathBuilder = normalizedLibraryUrl;

  // Open ancestors only so the current folder row is visible without expanding its children.
  for (let segmentIndex = 0; segmentIndex < pathSegments.length - 1; segmentIndex++) {
    pathBuilder = `${pathBuilder}/${pathSegments[segmentIndex]}`;
    openFolderUrls.push(pathBuilder);
  }

  return openFolderUrls;
}

function filterFolderTree(node: IFolderNode, query: string): IFolderNode | undefined {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return node;
  }

  const nameMatches = node.name.toLowerCase().includes(normalizedQuery);
  if (nameMatches) {
    return node;
  }

  const filteredChildren = node.children
    .map((childNode) => filterFolderTree(childNode, normalizedQuery))
    .filter((childNode): childNode is IFolderNode => childNode !== undefined);

  if (filteredChildren.length === 0) {
    return undefined;
  }

  return {
    ...node,
    children: filteredChildren
  };
}

function getSiteLoadErrorMessage(error: unknown, fallbackMessage: string): string {
  const rawMessage = getRawErrorMessage(error);

  if (rawMessage && isSiteNotFoundOrAccessError(rawMessage)) {
    return strings.SiteNotFoundOrNoAccessMessage;
  }

  if (rawMessage && isTechnicalHttpClientError(rawMessage)) {
    return fallbackMessage;
  }

  return getErrorMessage(error, fallbackMessage);
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  const rawMessage = getRawErrorMessage(error);
  if (rawMessage) {
    return rawMessage;
  }

  return fallbackMessage;
}

function getRawErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return undefined;
}

function isSiteNotFoundOrAccessError(message: string): boolean {
  return /\[(401|403|404)\]/.test(message) ||
    /\b(401|403|404)\b/.test(message) ||
    /access\s*denied/i.test(message) ||
    /unauthorized/i.test(message) ||
    /forbidden/i.test(message) ||
    /does not exist/i.test(message) ||
    /site\s+.*not\s+found/i.test(message);
}

function isTechnicalHttpClientError(message: string): boolean {
  return /Error making HttpClient request in queryable/i.test(message);
}

function isValidHttpsSiteUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeAbsoluteUrl(absoluteUrl: string): string {
  try {
    const parsed = new URL(absoluteUrl.trim());
    const path = normalizeServerRelativeUrl(parsed.pathname);
    const origin = parsed.protocol === 'http:'
      ? `https://${parsed.host}`
      : parsed.origin;
    return path === '/' ? origin : `${origin}${path}`.toLowerCase();
  } catch {
    return absoluteUrl.trim().toLowerCase();
  }
}

function normalizeServerRelativeUrl(serverRelativeUrl: string): string {
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
