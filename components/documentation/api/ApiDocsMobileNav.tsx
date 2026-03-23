"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ApiDocSection } from "./types";

interface ApiDocsMobileNavProps {
    sections: ApiDocSection[];
    activeSectionId: string | null;
    activeHeadingId: string | null;
    onNavigate: (headingId: string) => void;
}

export function ApiDocsMobileNav({
    sections,
    activeSectionId,
    activeHeadingId,
    onNavigate,
}: ApiDocsMobileNavProps) {
    const [open, setOpen] = useState(false);

    const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];

    const handleNavigate = (headingId: string) => {
        onNavigate(headingId);
        setOpen(false);
    };

    return (
        <div className="lg:hidden">
            <div className="sticky top-16 z-30 mb-5 flex items-center justify-between rounded-xl border border-border bg-background/95 px-3 py-2 backdrop-blur">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Section
                    </p>
                    <p className="text-sm font-medium text-foreground">{activeSection?.title ?? "API Docs"}</p>
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="gap-1.5">
                            <Menu className="size-4" />
                            Sections
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[85dvh] gap-0 p-0 sm:max-w-md">
                        <DialogHeader className="border-b border-border px-4 py-3">
                            <DialogTitle>API Navigation</DialogTitle>
                        </DialogHeader>

                        <ScrollArea className="h-[70dvh] px-3 py-3">
                            <div className="space-y-3">
                                {sections.map((section) => {
                                    const sectionActive = section.id === activeSectionId;

                                    return (
                                        <div key={section.id} className="rounded-lg border border-border/60">
                                            <button
                                                type="button"
                                                onClick={() => handleNavigate(section.id)}
                                                className={cn(
                                                    "w-full rounded-lg px-3 py-2 text-left text-sm font-medium",
                                                    sectionActive
                                                        ? "bg-primary/10 text-foreground"
                                                        : "text-foreground"
                                                )}
                                            >
                                                {section.title}
                                            </button>

                                            <div className="space-y-1 px-2 pb-2">
                                                {section.subheadings.map((subheading) => {
                                                    const subheadingActive = subheading.id === activeHeadingId;

                                                    return (
                                                        <button
                                                            key={subheading.id}
                                                            type="button"
                                                            onClick={() => handleNavigate(subheading.id)}
                                                            className={cn(
                                                                "w-full rounded-md px-2 py-1.5 text-left text-xs",
                                                                subheadingActive
                                                                    ? "bg-primary/10 text-foreground"
                                                                    : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {subheading.title}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
