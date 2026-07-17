"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { isAdminEmail } from "@/lib/admin-config";
import { RefreshCw, Link as LinkIcon, Loader2, Search, MoreVertical, Globe, ShieldAlert, CalendarClock, Infinity, Trash2, X, Filter, Unlock } from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Link from "next/link";
import { Users, Ghost } from "lucide-react";

type LinkUser = {
    id: string;
    email: string;
    name: string;
    linksCreated: number;
    activeLinks: number;
};

type UserLink = {
    slug: string;
    originalUrl: string;
    createdAt: number;
    expiresAt: number | null;
    isActive: boolean;
    totalClicks: number;
    guestSessionId?: string;
};

export default function AdminLinksPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<LinkUser[]>([]);
    const [isFetchingUsers, setIsFetchingUsers] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal state
    const [selectedUser, setSelectedUser] = useState<LinkUser | null>(null);
    const [userLinks, setUserLinks] = useState<UserLink[]>([]);
    const [isFetchingLinks, setIsFetchingLinks] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{type: 'single' | 'batch', target?: string, count?: number} | null>(null);
    const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
    const [linkSearchQuery, setLinkSearchQuery] = useState("");
    const [linkFilter, setLinkFilter] = useState<"all" | "active" | "expired" | "revoked">("all");
    const [guestStats, setGuestStats] = useState<{total: number, active: number} | null>(null);
    const [guestLinks, setGuestLinks] = useState<UserLink[]>([]);

    useEffect(() => {
        let mounted = true;
        let unsubGuest = () => {};

        const setupGuestListener = () => {
            const guestQuery = query(collection(db, "links"), where("userId", "==", "anonymous"));
            unsubGuest = onSnapshot(guestQuery, (snapshot) => {
                const newGuestLinks: UserLink[] = [];
                let active = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.isActive) active++;
                    newGuestLinks.push({
                        slug: data.slug,
                        originalUrl: data.originalUrl,
                        createdAt: data.createdAt,
                        expiresAt: data.expiresAt,
                        isActive: data.isActive,
                        totalClicks: data.totalClicks || 0,
                        guestSessionId: data.guestSessionId || undefined,
                    });
                });
                newGuestLinks.sort((a, b) => b.createdAt - a.createdAt);
                setGuestStats({ total: snapshot.size, active });
                setGuestLinks(newGuestLinks);
            }, (error) => {
                console.error("Guest listener error", error);
            });
        };

        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u && mounted) {
                setUser(u);
                setLoading(false);
                if (isAdminEmail(u.email)) {
                    loadUsers(u);
                    setupGuestListener();
                }
            } else if (mounted) {
                setUser(null);
                setLoading(false);
                unsubGuest();
            }
        });
        
        
        return () => {
            mounted = false;
            unsub();
            unsubGuest();
        };
    }, []);

    const loadUsers = async (currentUser: any = user) => {
        if (!currentUser) return;
        setIsFetchingUsers(true);
        try {
            const token = await currentUser.getIdToken();
            const [res] = await Promise.all([
                fetch("/api/admin/links/users", { headers: { Authorization: `Bearer ${token}` } }),
                new Promise(r => setTimeout(r, 800)) // UX delay
            ]);
            const data = await res.json();
            if (data.users) {
                setUsers(data.users);
            }
            // guestStats is populated automatically via onSnapshot
        } catch (e) {
            toast.error("Failed to load users");
        } finally {
            setIsFetchingUsers(false);
        }
    };

    const loadUserLinks = async (targetUser: LinkUser) => {
        if (!user) return;
        
        if (targetUser.id === "anonymous") {
            // we skip API fetch, the render will use guestLinks
            setIsFetchingLinks(false);
            return;
        }

        setIsFetchingLinks(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/links/user/${targetUser.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.links) {
                setUserLinks(data.links);
            }
        } catch (e) {
            toast.error("Failed to load user links");
        } finally {
            setIsFetchingLinks(false);
        }
    };

    const handleUserClick = (targetUser: LinkUser) => {
        setSelectedUser(targetUser);
        setSelectedLinks(new Set()); // Reset selections on new user
        setLinkSearchQuery(""); // Reset search
        setLinkFilter("all"); // Reset filter
        loadUserLinks(targetUser);
    };

    const handleLinkAction = async (slug: string, action: string, newExpiry?: number) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/links/${slug}`, {
                method: "PATCH",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ action, newExpiry })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Link updated successfully");
                if (selectedUser) loadUserLinks(selectedUser);
            } else {
                toast.error(data.message || "Failed to update link");
            }
        } catch (e) {
            toast.error("Error updating link");
        }
    };

    const handleDeleteLink = async (slug: string) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/links/${slug}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Link completely deleted from system.");
                setConfirmDelete(null);
                if (selectedUser) {
                    loadUserLinks(selectedUser);
                    // Also refresh users in background to update counts
                    loadUsers(user);
                }
            } else {
                toast.error(data.message || "Failed to delete link");
            }
        } catch (e) {
            toast.error("Error deleting link");
        }
    };

    const handleBatchAction = async (action: string, newExpiry?: number) => {
        if (!user || selectedLinks.size === 0) return;
        
        if (action === "delete") {
            setConfirmDelete({ type: 'batch', count: selectedLinks.size });
            return;
        }
        
        const slugs = Array.from(selectedLinks);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/links/batch", {
                method: "PATCH",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ slugs, action, newExpiry })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Batch operation successful");
                if (selectedUser) loadUserLinks(selectedUser);
                setSelectedLinks(new Set());
                if (action === "delete") loadUsers(user);
            } else {
                toast.error(data.message || "Failed to execute batch operation");
            }
        } catch (e) {
            toast.error("Error executing batch operation");
        }
    };

    const executeBatchDelete = async () => {
        if (!user || selectedLinks.size === 0) return;
        const slugs = Array.from(selectedLinks);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/links/batch", {
                method: "DELETE",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ slugs })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Batch delete successful");
                if (selectedUser) loadUserLinks(selectedUser);
                setSelectedLinks(new Set());
                loadUsers(user);
                setConfirmDelete(null);
            } else {
                toast.error(data.message || "Failed to execute batch delete");
            }
        } catch (e) {
            toast.error("Error executing batch delete");
        }
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return null;
    if (!user || !isAdminEmail(user.email)) return null;

    return (
        <div className="mx-auto w-full px-4 py-4 pb-24 lg:px-8 lg:py-6">
            <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Admin Console</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Link Management</h1>
                <p className="mt-2 text-base text-slate-600">God Mode: Oversee and manage all system-generated short links.</p>
            </div>

            <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-slate-100 p-1">
                    <TabsTrigger value="users" className="data-[state=active]:bg-white rounded-md py-2 shadow-sm transition-all text-sm font-medium">
                        <Users className="h-4 w-4 mr-2" /> Registered Users
                    </TabsTrigger>
                    <TabsTrigger value="guests" className="data-[state=active]:bg-white rounded-md py-2 shadow-sm transition-all text-sm font-medium relative">
                        <Ghost className="h-4 w-4 mr-2" /> Anonymous Guests
                        {(guestStats?.active || 0) > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-slate-100 animate-in zoom-in">
                                {guestStats?.active}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="m-0">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-slate-200 bg-slate-50/30 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100/80">
                            <LinkIcon className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight text-slate-900">User Directory</h2>
                            <p className="text-sm text-slate-500">Select a user to manage their links.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Search by name or email..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 w-full sm:w-64 border-slate-200"
                            />
                        </div>
                        <Button 
                            variant="outline"
                            onClick={() => loadUsers(user)}
                            disabled={isFetchingUsers}
                            className="h-10 px-4 text-slate-600"
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isFetchingUsers ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-4">User</th>
                                <th scope="col" className="px-6 py-4">Email</th>
                                <th scope="col" className="px-6 py-4">Active Links</th>
                                <th scope="col" className="px-6 py-4">Lifetime Created</th>
                                <th scope="col" className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {isFetchingUsers && users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-300" />
                                        <p>Loading users...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <p>No users found matching your criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => handleUserClick(u)}>
                                        <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                                        <td className="px-6 py-4 text-slate-500">{u.email}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                                                {u.activeLinks}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{u.linksCreated}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="ghost" size="sm" className="h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                                                Manage
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                </div>
                </TabsContent>

                <TabsContent value="guests" className="m-0">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row items-center justify-between p-6 sm:p-8">
                        <div className="flex-1 max-w-lg mb-6 md:mb-0 md:pr-8 text-left">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Ghost className="h-6 w-6 text-slate-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Guest Link Management</h3>
                            <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                                Manage all short links generated by unregistered users across the entire platform. This includes tracking, wiping, and rate-limit clearing.
                            </p>
                            <Button 
                                size="lg" 
                                className="w-full sm:w-auto h-11 px-8 font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                onClick={() => handleUserClick({
                                    id: "anonymous",
                                    email: "Public & Unregistered Traffic",
                                    name: "Anonymous Guests",
                                    linksCreated: guestStats?.total || 0,
                                    activeLinks: guestStats?.active || 0
                                } as any)}
                            >
                                Manage Guest Links
                            </Button>
                        </div>
                        
                        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4 flex-shrink-0">
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 min-w-[160px]">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Links</p>
                                <p className="text-3xl font-bold text-slate-900">{guestStats?.total || 0}</p>
                            </div>
                            <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100/50 min-w-[160px]">
                                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">Active Links</p>
                                <p className="text-3xl font-bold text-indigo-700">{guestStats?.active || 0}</p>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Link Management Modal */}
            <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                <DialogContent className="max-w-[95vw] lg:max-w-[85vw] 2xl:max-w-[1400px] max-h-[90vh] overflow-hidden flex flex-col p-0 bg-slate-50 admin-scrollbar [&>button:last-child]:hidden">
                    <div className="p-6 border-b border-slate-200 bg-white shadow-sm z-10 flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <Globe className="h-6 w-6 text-indigo-500" />
                                    {selectedUser?.name}
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 mt-1.5 text-base">
                                    {selectedUser?.email}
                                </DialogDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                {selectedLinks.size > 0 && (
                                    <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                        <span className="text-sm font-semibold text-indigo-700">
                                            {selectedLinks.size} selected
                                        </span>
                                        <div className="h-4 w-px bg-indigo-200 mx-1"></div>
                                        <Button size="sm" variant="outline" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => handleBatchAction("revoke")}>
                                            <ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Revoke
                                        </Button>
                                        {selectedUser?.id === "anonymous" && (
                                            <Button size="sm" variant="outline" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => handleBatchAction("lift_guest_lock")}>
                                                <Unlock className="h-3.5 w-3.5 mr-1.5" /> Lift Lock
                                            </Button>
                                        )}
                                        <Button size="sm" variant="outline" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => handleBatchAction("make_permanent")}>
                                            <Infinity className="h-3.5 w-3.5 mr-1.5" /> Permanent
                                        </Button>
                                        <Button size="sm" variant="outline" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => handleBatchAction("extend_expiry", Date.now() + 30 * 24 * 60 * 60 * 1000)}>
                                            <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> +30 Days
                                        </Button>
                                        <Button size="sm" variant="destructive" className="bg-rose-600 hover:bg-rose-700" onClick={() => handleBatchAction("delete")}>
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                        </Button>
                                    </div>
                                )}
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full" onClick={() => setSelectedUser(null)}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        
                        {/* Filters & Search */}
                        <div className="flex items-center justify-between bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                                {(["all", "active", "expired", "revoked"] as const).map(f => (
                                    <Button 
                                        key={f}
                                        variant={linkFilter === f ? "default" : "ghost"} 
                                        size="sm" 
                                        onClick={() => setLinkFilter(f)}
                                        className={`capitalize ${linkFilter === f ? 'bg-slate-800' : 'text-slate-600'}`}
                                    >
                                        {f}
                                    </Button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder="Search user links..." 
                                    value={linkSearchQuery}
                                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                                    className="pl-9 h-9 w-64 border-slate-200 bg-white"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 relative admin-scrollbar">
                        {isFetchingLinks ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-400" />
                                <p>Loading links...</p>
                            </div>
                        ) : (selectedUser?.id === "anonymous" ? guestLinks.length === 0 : userLinks.length === 0) ? (
                            <div className="py-20 text-center text-slate-500">
                                <Globe className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                                <p>This user has no active links.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
                                {(() => {
                                    const sourceLinks = selectedUser?.id === "anonymous" ? guestLinks : userLinks;
                                    const displayedLinks = sourceLinks.filter(l => {
                                        const isExpired = l.expiresAt && Date.now() > l.expiresAt;
                                        const isRevoked = !l.isActive;
                                        
                                        // Status filter
                                        if (linkFilter === "active" && (isExpired || isRevoked)) return false;
                                        if (linkFilter === "expired" && (!isExpired || isRevoked)) return false;
                                        if (linkFilter === "revoked" && !isRevoked) return false;
                                        
                                        // Text search filter
                                        if (linkSearchQuery) {
                                            const q = linkSearchQuery.toLowerCase();
                                            return l.slug.toLowerCase().includes(q) || (l.originalUrl && l.originalUrl.toLowerCase().includes(q));
                                        }
                                        return true;
                                    });
                                    
                                    if (displayedLinks.length === 0) {
                                        return (
                                            <div className="py-20 text-center text-slate-500">
                                                <Search className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                                                <p>No links found matching your filters.</p>
                                            </div>
                                        );
                                    }
                                    
                                    return (
                                        <>
                                            <div className="flex items-center px-2">
                                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                                        checked={displayedLinks.length > 0 && selectedLinks.size === displayedLinks.length}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedLinks(new Set(displayedLinks.map(l => l.slug)));
                                                            } else {
                                                                setSelectedLinks(new Set());
                                                            }
                                                        }}
                                                    />
                                                    <span className="text-sm font-medium text-slate-600">Select All ({displayedLinks.length})</span>
                                                </label>
                                            </div>
                                            {displayedLinks.map(link => {
                                                const isExpired = link.expiresAt && Date.now() > link.expiresAt;
                                                const isRevoked = !link.isActive;
                                                
                                                return (
                                        <div key={link.slug} className={`bg-white rounded-xl border p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 ${selectedLinks.has(link.slug) ? 'border-indigo-400 ring-1 ring-indigo-400/20 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer mt-1 self-start md:self-center"
                                                    checked={selectedLinks.has(link.slug)}
                                                    onChange={(e) => {
                                                        const newSet = new Set(selectedLinks);
                                                        if (e.target.checked) newSet.add(link.slug);
                                                        else newSet.delete(link.slug);
                                                        setSelectedLinks(newSet);
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                    <a href={`/${link.slug}`} target="_blank" rel="noreferrer" className="text-lg font-bold text-indigo-600 hover:underline">
                                                        /{link.slug}
                                                    </a>
                                                    {isRevoked ? (
                                                        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">Revoked</span>
                                                    ) : isExpired ? (
                                                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Expired</span>
                                                    ) : link.expiresAt === null ? (
                                                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Permanent</span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">Active</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-500 truncate mb-2" title={link.originalUrl}>
                                                    {link.originalUrl}
                                                </p>
                                                <div className="flex items-center gap-4 text-[11px] text-slate-400 uppercase tracking-wider font-medium">
                                                    <span>Clicks: {link.totalClicks}</span>
                                                    <span>•</span>
                                                    <span>Created: {new Date(link.createdAt).toLocaleDateString()}</span>
                                                    {link.guestSessionId && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100" title="Device/Session ID">
                                                                Device: {link.guestSessionId.includes('-') ? link.guestSessionId.split('-')[0] : link.guestSessionId.substring(0, 8)}...
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon" className="h-9 w-9">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem onClick={() => handleLinkAction(link.slug, isRevoked ? "enable" : "revoke")}>
                                                                <ShieldAlert className="h-4 w-4 mr-2" />
                                                                {isRevoked ? "Re-enable Link" : "Revoke Link"}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleLinkAction(link.slug, "extend_expiry", Date.now() + 7 * 24 * 60 * 60 * 1000)}>
                                                                <CalendarClock className="h-4 w-4 mr-2" />
                                                                Extend +7 Days
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleLinkAction(link.slug, "extend_expiry", Date.now() + 30 * 24 * 60 * 60 * 1000)}>
                                                                <CalendarClock className="h-4 w-4 mr-2" />
                                                                Extend +30 Days
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleLinkAction(link.slug, "make_permanent")}>
                                                                <Infinity className="h-4 w-4 mr-2" />
                                                                Make Permanent
                                                            </DropdownMenuItem>
                                                            {selectedUser?.id === "anonymous" && (
                                                                <DropdownMenuItem onClick={() => handleLinkAction(link.slug, "lift_guest_lock")}>
                                                                    <Unlock className="h-4 w-4 mr-2" />
                                                                    Lift Signup Lock
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem 
                                                                className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                                                                onClick={() => setConfirmDelete({ type: 'single', target: link.slug })}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Delete from System
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                            </div>
                                        </div>
                                        );
                                    })}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-rose-600 flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5" />
                            Confirm System Wipe
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 pt-3">
                            You are about to completely wipe 
                            <strong className="text-slate-900 mx-1">
                                {confirmDelete?.type === 'single' ? `/${confirmDelete.target}` : `${confirmDelete?.count} selected links`}
                            </strong>
                            from the entire system.
                            <br/><br/>
                            This will permanently destroy the link(s), all associated analytics, historical data, and revoke caching across edge servers. This action <strong>cannot</strong> be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => confirmDelete?.type === 'single' ? handleDeleteLink(confirmDelete.target!) : executeBatchDelete()}>
                            Yes, Wipe Completely
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
