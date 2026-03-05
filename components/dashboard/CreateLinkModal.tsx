"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export function CreateLinkModal({ children }: { children?: React.ReactNode }) {
    const [open, setOpen] = useState(false);

    // We'll wrap the trigger in a DialogTrigger to control the Dialog state natively
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button className="shadow-sm">
                        <Link2 className="mr-2 h-4 w-4" />
                        Create Link
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background border-zinc-200 dark:border-zinc-800 gap-0">
                <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <DialogTitle className="text-xl font-medium tracking-tight">Create new link</DialogTitle>
                </DialogHeader>

                <div className="p-6 flex flex-col gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="destination">Destination URL</Label>
                        <Input
                            id="destination"
                            placeholder="https://example.com/very-long-url"
                            className="h-10 transition-colors focus-visible:ring-zinc-800"
                        />
                    </div>

                    <div className="space-y-4 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                        <div className="space-y-2">
                            <Label className="flex items-center justify-between">
                                <span>Short Link <span className="text-zinc-500 font-normal">(optional)</span></span>
                            </Label>
                            <div className="flex rounded-md shadow-sm">
                                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-sm">
                                    xurl.eu.cc/
                                </span>
                                <Input
                                    type="text"
                                    className="rounded-l-none focus-visible:ring-zinc-800 h-10"
                                    placeholder="custom-alias"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={() => setOpen(false)} className="shadow-sm">Create link</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
