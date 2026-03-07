import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
    const sizeClasses = {
        sm: {
            container: "gap-2",
            box: "h-[20px] w-[20px] rounded-[5px] text-[10px]",
            text: "text-[12px] tracking-[0.16em]",
        },
        md: {
            container: "gap-3",
            box: "h-[28px] w-[28px] rounded-[7px] text-[14px]",
            text: "text-[17px] tracking-[0.16em]",
        },
        lg: {
            container: "gap-4",
            box: "h-[40px] w-[40px] rounded-[10px] text-[20px]",
            text: "text-[24px] tracking-[0.16em]",
        },
    };

    const s = sizeClasses[size];

    return (
        <Link
            href="/"
            className={cn(
                "flex items-center transition-opacity hover:opacity-90",
                s.container,
                className
            )}
        >
            <div
                className={cn(
                    "flex items-center justify-center bg-foreground text-background font-semibold tracking-tight transition-colors",
                    s.box
                )}
            >
                X
            </div>

            <div
                className={cn(
                    "flex items-center font-semibold text-foreground uppercase hidden sm:flex",
                    s.text
                )}
            >
                URL
            </div>
        </Link>
    );
}
