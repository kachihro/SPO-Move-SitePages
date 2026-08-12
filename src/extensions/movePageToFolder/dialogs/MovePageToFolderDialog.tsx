import {
  Button,
  Checkbox,
  Combobox,
  FluentProvider,
  Option,
  SearchBox,
  Spinner,
  Tree,
  TreeItem,
  TreeItemLayout,
  makeStyles,
  mergeClasses,
  webLightTheme
} from '@fluentui/react-components';
import type {
  ComboboxProps,
  TreeOpenChangeData,
  TreeOpenChangeEvent
} from '@fluentui/react-components';
import { FolderOpenRegular, FolderRegular } from '@fluentui/react-icons';
import { BaseDialog } from '@microsoft/sp-dialog';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import * as strings from 'MovePageToFolderCommandSetStrings';
import type {
  IFolderNode,
  IMetadataField,
  IMoveRequest,
  ISelectedPageInfo,
  ISiteOption
} from '../types';

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
  summaryStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
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
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    lineHeight: '24px'
  },
  sectionCaption: {
    color: '#616161',
    fontSize: '12px',
    lineHeight: '16px'
  },
  sitePicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  folderPicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  searchBox: {
    width: '100%',
    maxWidth: '100%'
  },
  treeContainer: {
    backgroundColor: '#ffffff',
    border: '1px solid #d1d1d1',
    borderRadius: '10px',
    height: '320px',
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
  metadataSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  metadataHeader: {
    alignItems: 'flex-start',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'space-between'
  },
  metadataActions: {
    display: 'flex',
    gap: '8px'
  },
  metadataList: {
    backgroundColor: '#ffffff',
    border: '1px solid #d1d1d1',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '220px',
    overflowY: 'auto',
    padding: '12px 14px'
  },
  metadataItem: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  metadataInternalName: {
    color: '#616161',
    fontSize: '12px',
    lineHeight: '16px',
    paddingLeft: '26px'
  },
  footer: {
    alignItems: 'center',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    gap: '16px',
    justifyContent: 'space-between',
    paddingTop: '4px'
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  movingStatus: {
    alignItems: 'center',
    display: 'flex',
    gap: '8px'
  },
  movingStatusText: {
    color: '#616161',
    fontSize: '13px'
  }
});

export interface IMovePageToFolderDialogProps {
  currentLibraryServerRelativeUrl: string;
  currentWebAbsoluteUrl: string;
  loadFolders: (webAbsoluteUrl: string, libraryServerRelativeUrl: string) => Promise<IFolderNode[]>;
  loadMatchingFields: (destinationWebAbsoluteUrl: string) => Promise<IMetadataField[]>;
  onMove: (request: IMoveRequest) => Promise<void>;
  page: ISelectedPageInfo;
  resolveSitePagesLibraryUrl: (webAbsoluteUrl: string) => Promise<string>;
  searchSites: (query: string) => Promise<ISiteOption[]>;
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

function FolderTreeNode(props: IFolderTreeNodeProps): React.ReactElement {
  const { classes, level, node, onSelect, selectedFolderUrl } = props;
  const isSelected = selectedFolderUrl === node.serverRelativeUrl;
  const isRoot = level === 0;
  const isLeaf = node.children.length === 0;

  const handleSelect = (
    event: React.KeyboardEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
  ): void => {
    const eventTarget = event.target as HTMLElement | null;

    if (!isLeaf && eventTarget?.closest('.fui-TreeItemLayout__expandIcon')) {
      return;
    }

    const currentTarget = event.currentTarget;

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
    currentLibraryServerRelativeUrl,
    currentWebAbsoluteUrl,
    loadFolders,
    loadMatchingFields,
    onDismiss,
    onMove,
    page,
    resolveSitePagesLibraryUrl,
    searchSites
  } = props;
  const classes = useStyles();

  const currentSiteOption = React.useMemo<ISiteOption>(() => ({
    absoluteUrl: normalizeAbsoluteUrl(currentWebAbsoluteUrl),
    isCurrentSite: true,
    serverRelativeUrl: '/',
    title: strings.ThisSiteLabel
  }), [currentWebAbsoluteUrl]);

  const [selectedSite, setSelectedSite] = React.useState<ISiteOption>(currentSiteOption);
  const [siteQuery, setSiteQuery] = React.useState<string>('');
  const [siteOptions, setSiteOptions] = React.useState<ISiteOption[]>([currentSiteOption]);
  const [isSearchingSites, setIsSearchingSites] = React.useState<boolean>(false);
  const [siteSearchError, setSiteSearchError] = React.useState<string | undefined>(undefined);

  const [libraryServerRelativeUrl, setLibraryServerRelativeUrl] = React.useState<string>(
    normalizeServerRelativeUrl(currentLibraryServerRelativeUrl)
  );
  const [folders, setFolders] = React.useState<IFolderNode[] | undefined>(undefined);
  const [isLoadingFolders, setIsLoadingFolders] = React.useState<boolean>(true);
  const [loadError, setLoadError] = React.useState<string | undefined>(undefined);
  const [selectedFolderUrl, setSelectedFolderUrl] = React.useState<string | undefined>(undefined);
  const [folderSearchQuery, setFolderSearchQuery] = React.useState<string>('');
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  const [matchingFields, setMatchingFields] = React.useState<IMetadataField[]>([]);
  const [selectedFieldNames, setSelectedFieldNames] = React.useState<string[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = React.useState<boolean>(false);
  const [metadataError, setMetadataError] = React.useState<string | undefined>(undefined);

  const [isMoving, setIsMoving] = React.useState<boolean>(false);
  const [moveError, setMoveError] = React.useState<string | undefined>(undefined);
  const [showSameFolderMessage, setShowSameFolderMessage] = React.useState<boolean>(false);

  const isCrossSite = normalizeAbsoluteUrl(selectedSite.absoluteUrl).toLowerCase() !==
    normalizeAbsoluteUrl(currentWebAbsoluteUrl).toLowerCase();

  React.useEffect(() => {
    let isMounted = true;
    const handle = window.setTimeout(() => {
      const runSearch = async (): Promise<void> => {
        setIsSearchingSites(true);
        setSiteSearchError(undefined);

        try {
          const results = await searchSites(siteQuery);
          if (!isMounted) {
            return;
          }

          setSiteOptions(results.length > 0 ? results : [currentSiteOption]);
        } catch (error: unknown) {
          if (!isMounted) {
            return;
          }

          setSiteSearchError(getErrorMessage(error, strings.LoadSitesError));
          setSiteOptions([currentSiteOption]);
        }

        if (isMounted) {
          setIsSearchingSites(false);
        }
      };

      runSearch().catch(() => undefined);
    }, siteQuery.trim() ? 300 : 0);

    return () => {
      isMounted = false;
      window.clearTimeout(handle);
    };
  }, [currentSiteOption, searchSites, siteQuery]);

  React.useEffect(() => {
    let isMounted = true;

    const loadDestinationFolders = async (): Promise<void> => {
      setIsLoadingFolders(true);
      setLoadError(undefined);
      setSelectedFolderUrl(undefined);
      setShowSameFolderMessage(false);
      setMoveError(undefined);
      setFolderSearchQuery('');

      try {
        const destinationLibraryUrl = selectedSite.isCurrentSite
          ? normalizeServerRelativeUrl(currentLibraryServerRelativeUrl)
          : await resolveSitePagesLibraryUrl(selectedSite.absoluteUrl);

        if (!isMounted) {
          return;
        }

        setLibraryServerRelativeUrl(destinationLibraryUrl);
        const loadedFolders = await loadFolders(selectedSite.absoluteUrl, destinationLibraryUrl);

        if (!isMounted) {
          return;
        }

        setFolders(loadedFolders);
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        setFolders(undefined);
        setLoadError(getErrorMessage(error, strings.LoadFoldersError));
      }

      if (isMounted) {
        setIsLoadingFolders(false);
      }
    };

    loadDestinationFolders().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [
    currentLibraryServerRelativeUrl,
    loadFolders,
    resolveSitePagesLibraryUrl,
    selectedSite
  ]);

  React.useEffect(() => {
    let isMounted = true;

    if (!isCrossSite) {
      setMatchingFields([]);
      setSelectedFieldNames([]);
      setMetadataError(undefined);
      setIsLoadingMetadata(false);
      return () => {
        isMounted = false;
      };
    }

    const loadMetadata = async (): Promise<void> => {
      setIsLoadingMetadata(true);
      setMetadataError(undefined);

      try {
        const fields = await loadMatchingFields(selectedSite.absoluteUrl);
        if (!isMounted) {
          return;
        }

        setMatchingFields(fields);
        setSelectedFieldNames(fields.map((field) => field.internalName));
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        setMatchingFields([]);
        setSelectedFieldNames([]);
        setMetadataError(getErrorMessage(error, strings.LoadMetadataError));
      }

      if (isMounted) {
        setIsLoadingMetadata(false);
      }
    };

    loadMetadata().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [isCrossSite, loadMatchingFields, selectedSite.absoluteUrl]);

  const folderTreeRoot = React.useMemo<IFolderNode | undefined>(() => {
    if (folders === undefined) {
      return undefined;
    }

    return {
      children: folders,
      name: strings.SitePagesRootLabel,
      serverRelativeUrl: libraryServerRelativeUrl
    };
  }, [folders, libraryServerRelativeUrl]);

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

  React.useEffect(() => {
    if (!folderTreeRoot) {
      return;
    }

    if (trimmedSearchQuery) {
      const filteredRoot = filterFolderTree(folderTreeRoot, trimmedSearchQuery) ?? {
        ...folderTreeRoot,
        children: []
      };
      setOpenItems(collectBranchFolderUrls(filteredRoot));
      return;
    }

    const defaultOpen = isCrossSite
      ? [folderTreeRoot.serverRelativeUrl]
      : collectDefaultOpenFolderUrls(folderTreeRoot.serverRelativeUrl, page.currentFolderUrl);

    setOpenItems(defaultOpen);
  }, [folderTreeRoot, isCrossSite, page.currentFolderUrl, trimmedSearchQuery]);

  const selectedFolderLabel = selectedFolderUrl
    ? formatFolderLabel(selectedFolderUrl, libraryServerRelativeUrl)
    : strings.NoFolderSelectedLabel;

  const isSameFolder = !isCrossSite && selectedFolderUrl === page.currentFolderUrl;
  const canMove = Boolean(selectedFolderUrl) &&
    !isMoving &&
    !isLoadingFolders &&
    !loadError &&
    !(isCrossSite && isLoadingMetadata);

  const handleSiteSelect: ComboboxProps['onOptionSelect'] = (_event, data) => {
    const nextAbsoluteUrl = data.optionValue;
    if (!nextAbsoluteUrl) {
      return;
    }

    const matchedSite = siteOptions.find(
      (site) => site.absoluteUrl.toLowerCase() === nextAbsoluteUrl.toLowerCase()
    ) ?? {
      absoluteUrl: nextAbsoluteUrl,
      isCurrentSite: nextAbsoluteUrl.toLowerCase() === currentWebAbsoluteUrl.toLowerCase(),
      serverRelativeUrl: '/',
      title: data.optionText || nextAbsoluteUrl
    };

    setSelectedSite({
      ...matchedSite,
      isCurrentSite: matchedSite.absoluteUrl.toLowerCase() ===
        normalizeAbsoluteUrl(currentWebAbsoluteUrl).toLowerCase()
    });
    setSiteQuery('');
  };

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
    if (!selectedFolderUrl || isMoving || isLoadingFolders || loadError) {
      return;
    }

    if (isSameFolder) {
      setMoveError(undefined);
      setShowSameFolderMessage(true);
      return;
    }

    setShowSameFolderMessage(false);
    setMoveError(undefined);
    setIsMoving(true);

    try {
      await onMove({
        destinationFolderUrl: selectedFolderUrl,
        destinationWebAbsoluteUrl: selectedSite.absoluteUrl,
        selectedFieldInternalNames: isCrossSite ? selectedFieldNames : []
      });
      setIsMoving(false);
      await onDismiss();
      return;
    } catch (error: unknown) {
      setMoveError(getErrorMessage(error, strings.MovePageError));
    }

    setIsMoving(false);
  };

  const handleOpenChange = (_event: TreeOpenChangeEvent, data: TreeOpenChangeData): void => {
    setOpenItems(Array.from(data.openItems, (itemValue) => String(itemValue)));
  };

  const toggleField = (internalName: string, checked: boolean): void => {
    setSelectedFieldNames((current) => {
      if (checked) {
        if (current.includes(internalName)) {
          return current;
        }

        return [...current, internalName];
      }

      return current.filter((name) => name !== internalName);
    });
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
          key={filteredFolderTreeRoot.serverRelativeUrl}
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
  const selectedSiteLabel = selectedSite.isCurrentSite
    ? strings.ThisSiteLabel
    : selectedSite.title;

  let metadataContent: React.ReactNode = null;

  if (isCrossSite) {
    if (isLoadingMetadata) {
      metadataContent = (
        <div className={classes.loadingState}>
          <Spinner label={strings.LoadingMetadataLabel} />
        </div>
      );
    } else if (metadataError) {
      metadataContent = (
        <div className={classes.errorMessage} role="alert">
          {metadataError}
        </div>
      );
    } else if (matchingFields.length === 0) {
      metadataContent = (
        <div className={classes.emptyState} role="status">
          {strings.NoMatchingMetadataMessage}
        </div>
      );
    } else {
      metadataContent = (
        <div className={classes.metadataList}>
          {matchingFields.map((field) => (
            <div className={classes.metadataItem} key={field.internalName}>
              <Checkbox
                checked={selectedFieldNames.includes(field.internalName)}
                label={field.displayName}
                onChange={(_event, data) => {
                  toggleField(field.internalName, Boolean(data.checked));
                }}
              />
              <span className={classes.metadataInternalName}>{field.internalName}</span>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <FluentProvider
      className={classes.provider}
      id="move-page-to-folder-dialog"
      theme={webLightTheme}
    >
      <div className={classes.root}>
        <div className={classes.header}>
          <div className={classes.title}>{strings.DialogTitle} - {page.fileName}</div>
        </div>

        <div className={classes.sitePicker}>
          <div className={classes.label}>{strings.SearchSitesLabel}</div>
          <Combobox
            aria-label={strings.SearchSitesLabel}
            onChange={(event) => {
              setSiteQuery(event.target.value);
            }}
            onOptionSelect={handleSiteSelect}
            placeholder={strings.SearchSitesPlaceholder}
            value={siteQuery || selectedSiteLabel}
          >
            {isSearchingSites ? (
              <Option disabled text={strings.SearchSitesPlaceholder} value="__searching">
                {strings.SearchSitesPlaceholder}
              </Option>
            ) : null}
            {siteOptions.map((site) => (
              <Option
                key={site.absoluteUrl}
                text={site.isCurrentSite ? strings.ThisSiteLabel : site.title}
                value={site.absoluteUrl}
              >
                {site.isCurrentSite ? strings.ThisSiteLabel : `${site.title} (${site.absoluteUrl})`}
              </Option>
            ))}
          </Combobox>
          {siteSearchError ? (
            <div className={classes.errorMessage} role="alert">
              {siteSearchError}
            </div>
          ) : null}
        </div>

        <div className={classes.folderPicker}>
          {showSearchBox ? (
            <SearchBox
              aria-label={strings.SearchFoldersPlaceholder}
              className={classes.searchBox}
              onChange={(_event, data) => {
                setFolderSearchQuery(data.value ?? '');
              }}
              placeholder={strings.SearchFoldersPlaceholder}
              value={folderSearchQuery}
            />
          ) : null}

          <div className={classes.treeContainer}>
            {treeContent}
          </div>
        </div>

        {isCrossSite ? (
          <div className={classes.metadataSection}>
            <div className={classes.metadataHeader}>
              <div>
                <div className={classes.sectionTitle}>{strings.MetadataSectionLabel}</div>
                <div className={classes.sectionCaption}>{strings.MetadataSectionHint}</div>
              </div>
              {matchingFields.length > 0 && !isLoadingMetadata && !metadataError ? (
                <div className={classes.metadataActions}>
                  <Button
                    appearance="subtle"
                    disabled={isMoving}
                    onClick={() => {
                      setSelectedFieldNames(matchingFields.map((field) => field.internalName));
                    }}
                    size="small"
                  >
                    {strings.SelectAllMetadataLabel}
                  </Button>
                  <Button
                    appearance="subtle"
                    disabled={isMoving}
                    onClick={() => {
                      setSelectedFieldNames([]);
                    }}
                    size="small"
                  >
                    {strings.ClearMetadataLabel}
                  </Button>
                </div>
              ) : null}
            </div>
            {metadataContent}
          </div>
        ) : null}

        <div className={classes.summaryCard}>
          <div className={classes.summaryStack}>
            <div>
              <div className={classes.label}>{strings.SelectedSiteLabel}</div>
              <div className={classes.value}>{selectedSiteLabel}</div>
            </div>
            <div>
              <div className={classes.label}>{strings.SelectedFolderLabel}</div>
              <div className={classes.value}>{selectedFolderLabel}</div>
            </div>
          </div>
        </div>

        {showSameFolderMessage ? (
          <div className={classes.errorMessage} role="status">
            {strings.SameFolderMessage}
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
                  {strings.MovingStatusLabel.replace('{0}', page.fileName)}
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

  protected render(): void {
    this.domElement.style.width = '100%';

    // SPFx hosts an older global Tabster instance than Fluent UI v9 expects.
    // Without this guard, dialog render can throw: Cannot read properties of undefined (reading 'set').
    // See https://github.com/SharePoint/sp-dev-docs/issues/10876
    patchSharePointTabsterInstance();

    ReactDOM.render(
      <MovePageToFolderDialogContent
        currentLibraryServerRelativeUrl={this._props.currentLibraryServerRelativeUrl}
        currentWebAbsoluteUrl={this._props.currentWebAbsoluteUrl}
        loadFolders={this._props.loadFolders}
        loadMatchingFields={this._props.loadMatchingFields}
        onDismiss={this._handleDismiss}
        onMove={this._handleMove}
        page={this._props.page}
        resolveSitePagesLibraryUrl={this._props.resolveSitePagesLibraryUrl}
        searchSites={this._props.searchSites}
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

  private _handleMove = async (request: IMoveRequest): Promise<void> => {
    await this._props.onMove(request);
    this._didMove = true;
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

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallbackMessage;
}

function normalizeAbsoluteUrl(absoluteUrl: string): string {
  return absoluteUrl.trim().replace(/\/+$/, '');
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
