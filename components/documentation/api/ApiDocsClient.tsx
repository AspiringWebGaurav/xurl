"use client";

import { useMemo } from "react";
import {
    API_DOCS_ENDPOINTS,
    API_DOCS_HEADING_ITEMS,
    API_DOCS_HEADING_TO_SECTION_MAP,
    API_DOCS_SECTIONS,
    API_DOCS_SNIPPETS,
} from "./content";
import { ApiDocsMobileNav } from "./ApiDocsMobileNav";
import { ApiDocsRightToc } from "./ApiDocsRightToc";
import { ApiDocsSection } from "./ApiDocsSection";
import { ApiDocsSidebar } from "./ApiDocsSidebar";
import { useScrollSpy } from "./useScrollSpy";

const ALL_HEADING_IDS = API_DOCS_HEADING_ITEMS.map((heading) => heading.id);

export function ApiDocsClient() {
    const { activeHeadingId, activeSectionId, scrollToHeading } = useScrollSpy({
        headingIds: ALL_HEADING_IDS,
        headingToSectionMap: API_DOCS_HEADING_TO_SECTION_MAP,
    });

    const resolvedSectionId = activeSectionId || API_DOCS_SECTIONS[0]?.id || null;

    const currentSection = useMemo(
        () => API_DOCS_SECTIONS.find((section) => section.id === resolvedSectionId) || API_DOCS_SECTIONS[0],
        [resolvedSectionId]
    );

    const currentSectionHeadings = useMemo(() => {
        if (!currentSection) return [];
        return API_DOCS_HEADING_ITEMS.filter(
            (heading) => heading.parentSectionId === currentSection.id
        );
    }, [currentSection]);

    const handleNavigate = (headingId: string) => {
        scrollToHeading(headingId, { behavior: "smooth", historyMode: "push" });
    };

    return (
        <div className="mx-auto grid max-w-[1400px] gap-6 lg:grid-cols-[240px_minmax(0,1fr)_220px] xl:grid-cols-[260px_minmax(0,1fr)_240px] xl:gap-8">
            <ApiDocsSidebar
                sections={API_DOCS_SECTIONS}
                activeSectionId={resolvedSectionId}
                onNavigate={handleNavigate}
            />

            <div className="min-w-0">
                <ApiDocsMobileNav
                    sections={API_DOCS_SECTIONS}
                    activeSectionId={resolvedSectionId}
                    activeHeadingId={activeHeadingId}
                    onNavigate={handleNavigate}
                />

                <div className="space-y-6 sm:space-y-8">
                    {API_DOCS_SECTIONS.map((section) => (
                        <ApiDocsSection
                            key={section.id}
                            section={section}
                            snippetsById={API_DOCS_SNIPPETS}
                            endpointsById={API_DOCS_ENDPOINTS}
                        />
                    ))}
                </div>
            </div>

            {currentSection && (
                <ApiDocsRightToc
                    sectionTitle={currentSection.title}
                    headings={currentSectionHeadings}
                    activeHeadingId={activeHeadingId}
                    onNavigate={handleNavigate}
                />
            )}
        </div>
    );
}
