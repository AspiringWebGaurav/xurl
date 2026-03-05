"use client";

import { motion } from "framer-motion";
import { Plus, Search, MoreHorizontal, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateLinkModal } from "@/components/dashboard/CreateLinkModal";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const MOCK_LINKS = Array.from({ length: 10 }).map((_, i) => ({
    id: `mock-${i}`,
    title: `Campaign ${i + 1}`,
    shortLink: `xurl.eu.cc/c${i + 1}`,
    longLink: "https://github.com/DareToSend/xurl",
    clicks: Math.floor(Math.random() * 5000),
    createdAt: "Oct 24, 2026",
}));

export default function LinksPage() {
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between p-8 pb-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Links</h1>
                    <p className="text-sm text-zinc-500">
                        Manage your shortened URLs and track performance.
                    </p>
                </div>
                <CreateLinkModal>
                    <Button className="shadow-sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Link
                    </Button>
                </CreateLinkModal>
            </div>

            <div className="px-8 pb-4 shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Search links..."
                        className="pl-9 h-9 w-[300px] bg-background shadow-sm"
                    />
                </div>
            </div>

            {/* Table Container - This matches the virtualization requirement area */}
            <div className="flex-1 overflow-auto px-8 pb-8">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-lg border bg-background shadow-sm overflow-hidden"
                >
                    <Table>
                        <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[300px]">Link</TableHead>
                                <TableHead>Destination</TableHead>
                                <TableHead className="w-[100px] text-right">Clicks</TableHead>
                                <TableHead className="w-[150px]">Created</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {MOCK_LINKS.map((link) => (
                                <TableRow key={link.id} className="group cursor-default">
                                    <TableCell>
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                            {link.title}
                                        </div>
                                        <div className="text-sm text-zinc-500 flex items-center gap-1.5 mt-0.5">
                                            {link.shortLink}
                                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded">
                                                <Copy className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-zinc-500">
                                        <a href={link.longLink} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 w-fit">
                                            {link.longLink}
                                            <ExternalLink className="h-3 w-3 shrink-0" />
                                        </a>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {link.clicks.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-zinc-500">
                                        {link.createdAt}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </motion.div>
            </div>
        </div>
    );
}
