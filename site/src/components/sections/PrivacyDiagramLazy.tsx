"use client";
import dynamic from "next/dynamic";

// The diagram's beam animation pulls in the Motion library. Importing it dynamically from a Client Component (Next
// only code-splits dynamic imports made there, not from Server Components) keeps Motion out of the main bundle.
export const DataPath = dynamic(() => import("./PrivacyDiagram").then((m) => m.DataPath));
