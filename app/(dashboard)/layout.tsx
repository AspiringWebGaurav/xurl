import { TopNavbar } from "@/components/layout/TopNavbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Workspace } from "@/components/layout/Workspace";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-full w-full flex-col overflow-hidden">
            <TopNavbar />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <Workspace className="bg-zinc-50/30 dark:bg-zinc-950/20">
                    {children}
                </Workspace>
            </div>
        </div>
    );
}
