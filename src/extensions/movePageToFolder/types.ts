export interface IFolderNode {
  children: IFolderNode[];
  name: string;
  serverRelativeUrl: string;
}

export interface ISelectedPageInfo {
  currentFolderUrl: string;
  fileName: string;
  listItemId?: number;
  serverRelativeUrl: string;
}

export interface ISiteOption {
  absoluteUrl: string;
  isCurrentSite: boolean;
  serverRelativeUrl: string;
  title: string;
}

export interface IMetadataField {
  displayName: string;
  internalName: string;
  typeAsString: string;
}

export interface IMoveRequest {
  destinationFolderUrl: string;
  destinationWebAbsoluteUrl: string;
  selectedFieldInternalNames: string[];
}

export interface IMoveOperationResult {
  destinationFileUrl: string;
}
