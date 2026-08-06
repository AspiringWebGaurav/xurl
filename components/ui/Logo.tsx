import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    size?: "sm" | "md" | "lg";
    href?: string | null;
    onClick?: (e: React.MouseEvent) => void;
}

export function Logo({ className, size = "md", href = "/", onClick }: LogoProps) {
    const sizeClasses = {
        sm: {
            container: "gap-2",
            box: "h-[22px] w-[22px] rounded-[6px] text-[11px]",
            text: "text-[12px] tracking-[0.16em]",
        },
        md: {
            container: "gap-3",
            box: "h-[30px] w-[30px] rounded-[8px] text-[15px]",
            text: "text-[17px] tracking-[0.16em]",
        },
        lg: {
            container: "gap-4",
            box: "h-[40px] w-[40px] rounded-[10px] text-[20px]",
            text: "text-[24px] tracking-[0.16em]",
        },
    };

    const s = sizeClasses[size];
    const content = (
        <>
            <div
                className={cn(
                    "flex items-center justify-center bg-foreground text-background font-bold tracking-tight transition-all active:scale-95 shadow-sm",
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
        </>
    );

    const containerClassName = cn(
        "flex items-center transition-opacity hover:opacity-90 cursor-pointer touch-manipulation z-50",
        s.container,
        className
    );

    if (!href) {
        return (
            <div className={containerClassName} onClick={onClick}>
                {content}
            </div>
        );
    }

    return (
        <Link
            href={href}
            className={containerClassName}
            onClick={(e) => {
                if (onClick) {
                    onClick(e);
                } else if (href) {
                    e.preventDefault();
                    window.location.href = href;
                }
            }}
        >
            {content}
        </Link>
    );
}
