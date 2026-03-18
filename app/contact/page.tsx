"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ContactPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const from = searchParams.get("from");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (submitting || loading || success) return;
        
        setError("");
        setLoading(true);
        setSubmitting(true);

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim().toLowerCase(),
                    subject: subject.trim() || null,
                    message: message.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Failed to send message");
                setLoading(false);
                setSubmitting(false);
                return;
            }

            setSuccess(true);
            setLoading(false);

            setTimeout(() => {
                toast.success("Message sent successfully!");
                router.push("/");
            }, 1500);
        } catch (err) {
            setError("Network error. Please try again.");
            setLoading(false);
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-[480px] rounded-[22px] border border-slate-200/80 bg-white px-7 py-7 shadow-sm">
                <div className="mb-6 flex flex-col items-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <Mail className="h-5 w-5" />
                    </div>
                    <h1 className="text-2xl font-semibold text-slate-900">Contact Support</h1>
                    <p className="mt-2 text-sm text-slate-600">We&apos;re here to help. Send us a message.</p>
                </div>

                {success ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <p className="text-lg font-semibold text-slate-900">Message sent successfully!</p>
                        <p className="mt-2 text-sm text-slate-600">Redirecting you back...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                                Name
                            </label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    setError("");
                                }}
                                disabled={loading}
                                required
                                maxLength={100}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value.toLowerCase());
                                    setError("");
                                }}
                                disabled={loading}
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-slate-700">
                                Subject <span className="text-slate-400">(optional)</span>
                            </label>
                            <Input
                                id="subject"
                                type="text"
                                placeholder="What is this about?"
                                value={subject}
                                onChange={(e) => {
                                    setSubject(e.target.value);
                                    setError("");
                                }}
                                disabled={loading}
                                maxLength={200}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-700">
                                Message
                            </label>
                            <textarea
                                id="message"
                                placeholder="Tell us what's on your mind..."
                                value={message}
                                onChange={(e) => {
                                    setMessage(e.target.value);
                                    setError("");
                                }}
                                disabled={loading}
                                required
                                minLength={10}
                                maxLength={2000}
                                rows={5}
                                className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                        </div>

                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || submitting || success}
                            className="w-full"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Send message
                                </>
                            )}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
}
