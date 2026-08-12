export interface IFolderNode {
  children: IFolderNode[];
  name: string;
  serverRelativeUrl: string;
}

export interface ISelectedPageInfo {
  currentFolderUrl: string;
  fileName: string;
  serverRelativeUrl: string;
}

export interface IMoveOperationResult {
  destinationFileUrl: string;
}

export interface IMovePagesResult {
  failures: Array<{
    fileName: string;
    message: string;
  }>;
  movedCount: number;
  results: IMoveOperationResult[];
}

export interface IResolvedSitePagesLibrary {
  libraryServerRelativeUrl: string;
  webAbsoluteUrl: string;
  webServerRelativeUrl: string;
}

export interface ILoadFoldersResult {
  folders: IFolderNode[];
  libraryServerRelativeUrl: string;
  webAbsoluteUrl: string;
}
