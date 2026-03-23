import { cn } from "@/lib/utils";
import { ApiCodeBlock } from "./ApiCodeBlock";
import type {
    ApiCodeSnippet,
    ApiDocBlock,
    ApiEndpointDefinition,
    ApiMethod,
} from "./types";

interface RenderApiDocBlockOptions {
    block: ApiDocBlock;
    snippetsById: Record<string, ApiCodeSnippet>;
    endpointsById: Record<string, ApiEndpointDefinition>;
}

const endpointMethodClassMap: Record<ApiMethod, string> = {
    GET: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    POST: "border-blue-500/30 bg-blue-500/10 text-blue-700",
    PUT: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    PATCH: "border-orange-500/30 bg-orange-500/10 text-orange-700",
    DELETE: "border-red-500/30 bg-red-500/10 text-red-700",
};

export function renderApiDocBlock({
    block,
    snippetsById,
    endpointsById,
}: RenderApiDocBlockOptions) {
    switch (block.type) {
        case "paragraph":
            return <p className="text-sm leading-7 text-muted-foreground">{block.text}</p>;

        case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
                <ListTag
                    className={cn(
                        "space-y-2 text-sm leading-7 text-muted-foreground",
                        block.ordered ? "list-decimal pl-5" : "list-disc pl-5"
                    )}
                >
                    {block.items.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ListTag>
            );
        }

        case "endpoint": {
            const endpoint = endpointsById[block.endpointId];
            if (!endpoint) return null;

            return (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={cn(
                                "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold",
                                endpointMethodClassMap[endpoint.method]
                            )}
                        >
                            {endpoint.method}
                        </span>
                        <code className="rounded bg-background px-2 py-0.5 font-mono text-xs text-foreground">
                            {endpoint.route}
                        </code>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{endpoint.description}</p>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">Source files</p>
                        {endpoint.sourceFiles.map((sourceFile) => (
                            <p key={sourceFile} className="font-mono text-[11px] leading-5">
                                {sourceFile}
                            </p>
                        ))}
                    </div>
                </div>
            );
        }

        case "code": {
            const snippet = snippetsById[block.snippetId];
            if (!snippet) return null;
            return <ApiCodeBlock snippet={snippet} />;
        }

        case "keyValue":
            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    {block.items.map((item) => (
                        <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {item.label}
                            </p>
                            <p className="mt-2 break-all rounded bg-muted px-2 py-1 font-mono text-sm text-foreground">
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>
            );

        case "quotaCards":
            return (
                <div className="grid gap-4 md:grid-cols-2">
                    {block.items.map((item) => (
                        <div key={item.plan} className="rounded-xl border border-border bg-card p-5">
                            <p className="text-sm font-semibold text-foreground">{item.plan}</p>
                            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{item.limit}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        </div>
                    ))}
                </div>
            );

        case "callout":
            return (
                <div
                    className={cn(
                        "rounded-xl border px-4 py-3 text-sm leading-6",
                        block.tone === "warning"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-800"
                            : "border-blue-500/30 bg-blue-500/10 text-blue-800"
                    )}
                >
                    {block.text}
                </div>
            );

        default:
            return null;
    }
}
