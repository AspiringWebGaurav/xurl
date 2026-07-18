import React from 'react';
import { cn } from '@/lib/utils'; // Reusing standard utility but no UI components

interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline';
    children: React.ReactNode;
}

export function MobileButton({ variant = 'primary', className, children, ...props }: MobileButtonProps) {
    const baseStyles = "w-full py-4 rounded-2xl font-semibold text-lg active:scale-[0.98] transition-transform text-center touch-manipulation";
    
    const variants = {
        primary: "bg-primary text-primary-foreground shadow-lg shadow-primary/25",
        secondary: "bg-white text-black",
        outline: "bg-white/5 border border-white/10 text-white backdrop-blur-md"
    };

    return (
        <button 
            className={cn(baseStyles, variants[variant], className)}
            {...props}
        >
            {children}
        </button>
    );
}
