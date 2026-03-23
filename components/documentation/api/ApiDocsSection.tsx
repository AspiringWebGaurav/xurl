"use client";

import { Fragment } from "react";
import { ApiHeadingAnchor } from "./ApiHeadingAnchor";
import { renderApiDocBlock } from "./renderers";
import type {
    ApiCodeSnippet,
    ApiDocSection,
    ApiEndpointDefinition,
} from "./types";

interface ApiDocsSectionProps {
    section: ApiDocSection;
    snippetsById: Record<string, ApiCodeSnippet>;
    endpointsById: Record<string, ApiEndpointDefinition>;
}

export function ApiDocsSection({ section, snippetsById, endpointsById }: ApiDocsSectionProps) {
    return (
        <section className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
            <ApiHeadingAnchor id={section.id} title={section.title} level={2} />
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.description}</p>

            {section.blocks.length > 0 && (
                <div className="mt-5 space-y-4">
                    {section.blocks.map((block, blockIndex) => (
                        <Fragment key={`${section.id}-block-${blockIndex}`}>
                            {renderApiDocBlock({
                                block,
                                snippetsById,
                                endpointsById,
                            })}
                        </Fragment>
                    ))}
                </div>
            )}

            {section.subheadings.map((subheading) => (
                <div key={subheading.id} className="mt-8 border-t border-border pt-7">
                    <ApiHeadingAnchor id={subheading.id} title={subheading.title} level={3} />
                    {subheading.description && (
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">
                            {subheading.description}
                        </p>
                    )}
                    <div className="mt-4 space-y-4">
                        {subheading.blocks.map((block, blockIndex) => (
                            <Fragment key={`${subheading.id}-block-${blockIndex}`}>
                                {renderApiDocBlock({
                                    block,
                                    snippetsById,
                                    endpointsById,
                                })}
                            </Fragment>
                        ))}
                    </div>
                </div>
            ))}
        </section>
    );
}
