import * as React from "react";
import { DataverseClient } from "./DataverseClient";

export const DataverseClientContext = React.createContext<DataverseClient | undefined>(undefined);

export function useDataverseClient(): DataverseClient {
  const client = React.useContext(DataverseClientContext);
  if (!client) {
    throw new Error("useDataverseClient must be used within a DataverseClientContext.Provider");
  }
  return client;
}
