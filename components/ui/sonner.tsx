"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = "system" } = useTheme()

    return (
        <Sonner
            theme={theme as ToasterProps["theme"]}
            position="top-center"
            richColors
            closeButton
            style={{ top: "64px" }}
            className="toaster group !z-[9999]"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-foreground group-[.toaster]:border-primary/20 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:p-3.5 group-[.toaster]:font-sans group-[.toaster]:w-[calc(100vw-2rem)] sm:group-[.toaster]:w-auto sm:group-[.toaster]:max-w-md",
                    description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
                    actionButton:
                        "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-semibold rounded-xl",
                    cancelButton:
                        "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground font-medium rounded-xl",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
