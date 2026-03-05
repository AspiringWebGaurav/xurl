"use client";

import { motion } from "framer-motion";
import { Link2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workspace } from "@/components/layout/Workspace";
import { TopNavbar } from "@/components/layout/TopNavbar";

export default function LoginPage() {
    return (
        <div className="flex h-full w-full flex-col">
            <TopNavbar />
            <Workspace className="flex items-center justify-center p-6 bg-zinc-50/30 dark:bg-zinc-950/30">
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-sm"
                >
                    <div className="flex flex-col gap-8 rounded-2xl bg-background border p-8 shadow-sm">

                        <div className="flex flex-col gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm mb-2">
                                <span className="text-zinc-50 font-semibold text-sm">X</span>
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight">Sign in to XURL</h1>
                            <p className="text-sm text-zinc-500">
                                Welcome back! Please enter your details.
                            </p>
                        </div>

                        <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="m@example.com"
                                        required
                                        className="h-10 transition-colors focus-visible:ring-zinc-800"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password">Password</Label>
                                        <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <Input
                                        id="password"
                                        type="password"
                                        required
                                        className="h-10 transition-colors focus-visible:ring-zinc-800"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button className="w-full h-10 shadow-sm" type="submit">Sign in</Button>
                                <Button variant="outline" className="w-full h-10" type="button">
                                    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="github" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                        <path d="M12.026 2c-5.509 0-9.974 4.465-9.974 9.974 0 4.406 2.857 8.145 6.821 9.465.499.09.679-.217.679-.481 0-.237-.008-.865-.011-1.696-2.775.602-3.361-1.338-3.361-1.338-.452-1.152-1.107-1.459-1.107-1.459-.905-.619.069-.605.069-.605 1.002.07 1.527 1.028 1.527 1.028.89 1.524 2.336 1.084 2.902.829.091-.645.351-1.085.635-1.334-2.214-.251-4.542-1.107-4.542-4.93 0-1.087.389-1.979 1.024-2.675-.101-.253-.446-1.268.099-2.64 0 0 .837-.269 2.742 1.021a9.582 9.582 0 0 1 2.496-.336 9.554 9.554 0 0 1 2.496.336c1.906-1.291 2.742-1.021 2.742-1.021.546 1.372.203 2.387.099 2.64.64.696 1.024 1.587 1.024 2.675 0 3.833-2.33 4.675-4.552 4.922.355.308.675.916.675 1.846 0 1.334-.012 2.41-.012 2.737 0 .267.178.577.687.479C19.146 20.115 22 16.379 22 11.974 22 6.465 17.535 2 12.026 2z" fill="currentColor"></path>
                                    </svg>
                                    Sign in with GitHub
                                </Button>
                            </div>
                        </form>

                        <div className="text-center text-sm text-zinc-500">
                            Don&apos;t have an account?{" "}
                            <Link href="/register" className="font-medium text-zinc-900 hover:underline">
                                Sign up
                            </Link>
                        </div>

                    </div>
                </motion.div>
            </Workspace>
        </div>
    );
}
