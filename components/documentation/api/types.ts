export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiCodeSnippet {
    id: string;
    label: string;
    language: string;
    code: string;
}

export interface ApiEndpointDefinition {
    id: string;
    method: ApiMethod;
    route: string;
    description: string;
    sourceFiles: string[];
}

export type ApiDocBlock =
    | {
        type: "paragraph";
        text: string;
    }
    | {
        type: "list";
        items: string[];
        ordered?: boolean;
    }
    | {
        type: "endpoint";
        endpointId: string;
    }
    | {
        type: "code";
        snippetId: string;
    }
    | {
        type: "keyValue";
        items: Array<{ label: string; value: string }>;
    }
    | {
        type: "quotaCards";
        items: Array<{ plan: string; limit: string; description: string }>;
    }
    | {
        type: "callout";
        text: string;
        tone?: "info" | "warning";
    };

export interface ApiDocSubheading {
    id: string;
    title: string;
    description?: string;
    blocks: ApiDocBlock[];
    endpointIds?: string[];
}

export interface ApiDocSection {
    id: string;
    title: string;
    description: string;
    blocks: ApiDocBlock[];
    subheadings: ApiDocSubheading[];
    endpointIds?: string[];
}

export interface ApiDocHeadingItem {
    id: string;
    title: string;
    level: 2 | 3;
    parentSectionId: string;
}

export interface ApiSectionEndpointRelation {
    sectionId: string;
    endpointIds: string[];
}

export interface LocalDocsIndex {
    schemaVersion: number;
    generatedAt: string;
    route: string;
    sections: Array<{
        id: string;
        title: string;
        description: string;
    }>;
    headings: Array<{
        id: string;
        title: string;
        level: "h2" | "h3";
        parentSectionId: string;
    }>;
    endpoints: Array<{
        id: string;
        method: ApiMethod;
        route: string;
        description: string;
    }>;
    sourceFileMappings: Array<{
        endpointId: string;
        files: string[];
    }>;
    sectionEndpointRelations: ApiSectionEndpointRelation[];
}
