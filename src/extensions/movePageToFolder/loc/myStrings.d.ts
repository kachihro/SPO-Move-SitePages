declare interface IMovePageToFolderCommandSetStrings {
  MoveToFolderCommand: string;
  DialogTitle: string;
  DialogTitleMultiple: string;
  SelectedPagesLabel: string;
  SelectedPagesCountLabel: string;
  CurrentFolderLabel: string;
  AvailableFoldersLabel: string;
  AvailableFoldersHint: string;
  SelectedFolderLabel: string;
  NoFolderSelectedLabel: string;
  CancelButton: string;
  MoveButton: string;
  MovingButton: string;
  MovingStatusLabel: string;
  LoadingFoldersLabel: string;
  EmptyFolderMessage: string;
  SearchFoldersPlaceholder: string;
  NoMatchingFoldersMessage: string;
  SameFolderMessage: string;
  SameFolderMessageMultiple: string;
  LoadFoldersError: string;
  MovePageError: string;
  MovePagesPartialError: string;
  SitePagesRootLabel: string;
  DestinationSiteLabel: string;
  DestinationSitePlaceholder: string;
  LoadSiteButton: string;
  LoadSiteButtonAriaLabel: string;
  LoadingSiteLabel: string;
  ConfirmSitePromptMessage: string;
  InvalidSiteUrlMessage: string;
  LoadSiteError: string;
  SiteNotFoundOrNoAccessMessage: string;
  CrossSiteMoveError: string;
  CrossSiteAccessDeniedMessage: string;
}

declare module 'MovePageToFolderCommandSetStrings' {
  const strings: IMovePageToFolderCommandSetStrings;
  export = strings;
}
