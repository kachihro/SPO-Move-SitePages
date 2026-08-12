declare interface IMovePageToFolderCommandSetStrings {
  MoveToFolderCommand: string;
  DialogTitle: string;
  CurrentFolderLabel: string;
  AvailableFoldersLabel: string;
  AvailableFoldersHint: string;
  SelectedFolderLabel: string;
  SelectedSiteLabel: string;
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
  LoadFoldersError: string;
  MovePageError: string;
  SitePagesRootLabel: string;
  ThisSiteLabel: string;
  SearchSitesPlaceholder: string;
  SearchSitesLabel: string;
  NoMatchingSitesMessage: string;
  LoadSitesError: string;
  SitePagesLibraryMissingError: string;
  MetadataSectionLabel: string;
  MetadataSectionHint: string;
  SelectAllMetadataLabel: string;
  ClearMetadataLabel: string;
  LoadingMetadataLabel: string;
  NoMatchingMetadataMessage: string;
  LoadMetadataError: string;
  CrossSiteDeleteFailedError: string;
}

declare module 'MovePageToFolderCommandSetStrings' {
  const strings: IMovePageToFolderCommandSetStrings;
  export = strings;
}
