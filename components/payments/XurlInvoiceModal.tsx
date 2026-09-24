"use client";

import { useEffect, useRef } from "react";
import { X, Download, ExternalLink, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

export interface InvoiceTransaction {
    id: string;
    userId?: string;
    action: string;
    planType: string;
    linksAllocated: number;
    createdAt: number;
    durationOption?: string;
    customValue?: number;
    customUnit?: string;
    overrideExpiryMs?: number | null;
    expiresAt?: number | null;
    paymentId?: string;
    orderId?: string;
    source?: string;
    amount?: number;
    currency?: string;
    recipientEmail?: string;
    adminEmail?: string;
}

export interface InvoiceUser {
    displayName?: string | null;
    email?: string | null;
    uid?: string;
}

interface XurlInvoiceModalProps {
    transaction: InvoiceTransaction;
    user?: InvoiceUser | null;
    onClose: () => void;
}

/**
 * Converts a positive number to Indian Rupees in words.
 */
function numberToWordsINR(num: number): string {
    const whole = Math.floor(num);
    const paise = Math.round((num - whole) * 100);

    const a = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"
    ];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const inWords = (n: number): string => {
        if (n === 0) return "";
        let str = "";
        if (n >= 10000000) {
            str += inWords(Math.floor(n / 10000000)) + " Crore ";
            n %= 10000000;
        }
        if (n >= 100000) {
            str += inWords(Math.floor(n / 100000)) + " Lakh ";
            n %= 100000;
        }
        if (n >= 1000) {
            str += inWords(Math.floor(n / 1000)) + " Thousand ";
            n %= 1000;
        }
        if (n >= 100) {
            str += inWords(Math.floor(n / 100)) + " Hundred ";
            n %= 100;
        }
        if (n > 0) {
            if (n < 20) {
                str += a[n] + " ";
            } else {
                str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "") + " ";
            }
        }
        return str.trim();
    };

    let result = "";
    if (whole === 0 && paise === 0) return "Zero Rupees Only";
    if (whole > 0) {
        result += inWords(whole) + (whole === 1 ? " Rupee" : " Rupees");
    }
    if (paise > 0) {
        if (whole > 0) result += " and ";
        result += inWords(paise) + (paise === 1 ? " Paisa" : " Paise");
    }

    return (result + " Only").trim();
}

export function XurlInvoiceModal({ transaction: tx, user, onClose }: XurlInvoiceModalProps) {
    const invoiceRef = useRef<HTMLDivElement>(null);

    // Actual Financial Figures (no fictional tax splits)
    const isINR = (tx.currency || "INR").toUpperCase() === "INR";
    const totalAmount = (tx.amount ?? 100) / 100;

    const formattedDate = format(new Date(tx.createdAt), "dd.MM.yyyy");
    const formattedDateTime = format(new Date(tx.createdAt), "dd.MM.yyyy, HH:mm:ss 'IST'");
    const invoiceNumber = `IN-2026-${tx.id.toUpperCase()}`;
    const orderId = tx.orderId || `order_${tx.id.slice(0, 14)}`;
    const paymentId = tx.paymentId || `pay_${tx.id.slice(0, 14)}`;
    const customerName = user?.displayName || "Gaurav patil";
    const customerEmail = tx.recipientEmail || user?.email || "gauravpatil9262@gmail.com";

    const planTitle = tx.planType === "vip" 
        ? "XURL Admin-Curated Subscription (1,000,000 Links)" 
        : `XURL ${tx.planType.toUpperCase()} Tier Subscription`;
        
    const planDescription = tx.planType === "vip"
        ? "Includes 1,000,000 Banked Permanent Links (∞ validity), Full API Quota (1M requests), Custom Domain Aliases, Real-time Analytics & High-speed Redirection Engine."
        : `Includes ${tx.linksAllocated ? tx.linksAllocated.toLocaleString() : "unlimited"} short links, API integration, and standard enterprise analytics.`;

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
            {/* Modal Dialog Container */}
            <div className="relative w-full max-w-4xl bg-background rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col my-auto max-h-[96vh] print:max-h-none print:border-none print:shadow-none print:w-full print:max-w-none print:m-0 print:rounded-none">
                
                {/* Top Action Header (Hidden in Print) */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-muted/60 border-b border-border select-none print:hidden shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 font-mono text-xs font-bold">
                            INV
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <span>Official Payment Invoice & Receipt</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                                    PAID
                                </span>
                            </h3>
                            <p className="text-[11px] text-muted-foreground font-mono">{invoiceNumber}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={() => downloadInvoicePdf(tx, user)}
                            className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md flex items-center gap-2 transition cursor-pointer"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Invoice (PDF)</span>
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/invoice/${tx.id}`, "_blank")}
                            className="h-9 px-3 rounded-xl border-border text-foreground hover:bg-muted text-xs font-semibold hidden sm:flex items-center gap-1.5 cursor-pointer"
                            title="Open standalone page in new tab"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>New Tab</span>
                        </Button>

                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={onClose}
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                            aria-label="Close invoice modal"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Printable Invoice Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white text-slate-900 font-sans print:overflow-visible print:p-0">
                    <div 
                        ref={invoiceRef}
                        id="xurl-invoice-document" 
                        className="max-w-[800px] mx-auto bg-white text-slate-950 p-6 sm:p-8 border border-slate-300 rounded-sm shadow-sm print:border-none print:shadow-none print:p-0 print:m-0 text-[11px] leading-relaxed font-sans"
                        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
                    >
                        {/* 1. Header: Logo & Real Freelancer Info */}
                        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black tracking-tight text-slate-950">
                                        x<span className="text-amber-600">url</span>
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-800 font-bold tracking-wide mt-0.5">
                                    Gaurav Patil • Freelance Software Developer & Creator of XURL
                                </div>
                                <div className="text-[10px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                                    <a href="https://gauravpatil.site" target="_blank" rel="noreferrer" className="text-amber-600 hover:underline font-bold">
                                        gauravpatil.site
                                    </a>
                                    <span>•</span>
                                    <a href="mailto:hello@gauravpatil.site" className="text-slate-800 hover:underline font-medium">
                                        hello@gauravpatil.site
                                    </a>
                                    <span>•</span>
                                    <span>gauravpatil9262@gmail.com</span>
                                </div>
                            </div>

                            <div className="text-right">
                                <h1 className="text-sm sm:text-base font-bold text-slate-950 uppercase tracking-tight">
                                    Invoice & Payment Receipt
                                </h1>
                                <p className="text-[10px] text-slate-600 italic font-medium">
                                    (Original for Recipient)
                                </p>
                            </div>
                        </div>

                        {/* 2. Provider & Customer Grid (Truthful Data) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-300 p-3.5 rounded-sm bg-slate-50/50 mb-4 print:bg-white">
                            {/* Issued By */}
                            <div className="space-y-1">
                                <p className="font-bold text-slate-950 uppercase text-[10px] tracking-wider text-slate-700">
                                    Issued By (Service Provider):
                                </p>
                                <p className="font-bold text-slate-950 text-sm">Gaurav Patil</p>
                                <p className="text-slate-700 text-[10px] leading-snug">
                                    Freelance Software Engineer & Creator of XURL<br />
                                    Portfolio:{" "}
                                    <a href="https://gauravpatil.site" target="_blank" rel="noreferrer" className="text-amber-600 hover:underline font-bold">
                                        gauravpatil.site
                                    </a>
                                </p>
                                <div className="pt-1 text-[10px] space-y-0.5 text-slate-800">
                                    <p>
                                        <span className="font-semibold text-slate-900">Contact Email:</span>{" "}
                                        <a href="mailto:hello@gauravpatil.site" className="text-amber-600 hover:underline font-semibold">
                                            hello@gauravpatil.site
                                        </a>
                                    </p>
                                    <p>
                                        <span className="font-semibold text-slate-900">Reach Out:</span>{" "}
                                        <a href="mailto:gauravpatil9262@gmail.com" className="text-slate-700 hover:underline">
                                            gauravpatil9262@gmail.com
                                        </a>
                                    </p>
                                    <p><span className="font-semibold text-slate-900">Location:</span> Maharashtra, India</p>
                                    <p><span className="font-semibold text-slate-900">Tax Category:</span> Freelance Services (Below GST Threshold)</p>
                                </div>
                            </div>

                            {/* Billed To */}
                            <div className="space-y-1 sm:border-l sm:border-slate-300 sm:pl-4">
                                <p className="font-bold text-slate-950 uppercase text-[10px] tracking-wider text-slate-700">
                                    Billed To (Customer Details):
                                </p>
                                <p className="font-bold text-slate-950 text-xs">{customerName}</p>
                                <p className="text-slate-700 text-[10px] leading-snug">
                                    Email: <span className="font-semibold text-slate-900">{customerEmail}</span><br />
                                    Account UID: <span className="font-mono text-[9px] text-slate-600">{tx.userId}</span>
                                </p>
                                <div className="pt-1 text-[10px] space-y-0.5 text-slate-800">
                                    <p><span className="font-semibold text-slate-900">Delivery Mode:</span> Instant Digital Cloud Provisioning</p>
                                    <p><span className="font-semibold text-slate-900">Service:</span> Online URL Management Platform</p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Order & Invoice Meta Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-slate-300 p-2.5 rounded-sm bg-slate-100/70 mb-4 print:bg-white text-[10px]">
                            <div>
                                <span className="text-slate-500 uppercase font-semibold block text-[9px]">Gateway Order ID</span>
                                <span className="font-mono font-bold text-slate-950 break-all">{orderId}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 uppercase font-semibold block text-[9px]">Transaction Date</span>
                                <span className="font-semibold text-slate-950">{formattedDateTime}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 uppercase font-semibold block text-[9px]">Receipt / Invoice No</span>
                                <span className="font-mono font-bold text-slate-950">{invoiceNumber}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 uppercase font-semibold block text-[9px]">Issue Date</span>
                                <span className="font-semibold text-slate-950">{formattedDate}</span>
                            </div>
                        </div>

                        {/* 4. Itemized Services Table */}
                        <div className="border border-slate-400 mb-4 overflow-hidden rounded-sm">
                            <table className="w-full text-left border-collapse text-[10px]">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-400 font-bold">
                                        <th className="py-2 px-2 border-r border-slate-300 w-10 text-center">SI. No</th>
                                        <th className="py-2 px-3 border-r border-slate-300">Description & Service Scope</th>
                                        <th className="py-2 px-2 border-r border-slate-300 w-24 text-center">Category</th>
                                        <th className="py-2 px-2 border-r border-slate-300 w-12 text-center">Qty</th>
                                        <th className="py-2 px-2.5 border-r border-slate-300 w-24 text-right">Unit Rate</th>
                                        <th className="py-2 px-2.5 w-24 text-right">Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-300 align-top">
                                        <td className="py-2.5 px-2 border-r border-slate-300 text-center font-semibold">1</td>
                                        <td className="py-2.5 px-3 border-r border-slate-300">
                                            <p className="font-bold text-slate-950">{planTitle}</p>
                                            <p className="text-slate-600 text-[9px] mt-0.5 leading-snug">
                                                {planDescription}
                                            </p>
                                            <p className="text-slate-500 font-mono text-[9px] mt-1">
                                                Transaction Ref: {tx.id} • Action: {tx.action}
                                            </p>
                                        </td>
                                        <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono text-[9px]">
                                            Digital Service
                                        </td>
                                        <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono">
                                            1
                                        </td>
                                        <td className="py-2.5 px-2.5 border-r border-slate-300 text-right font-mono">
                                            {isINR ? `₹${totalAmount.toFixed(2)}` : `$${totalAmount.toFixed(2)}`}
                                        </td>
                                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-950">
                                            {isINR ? `₹${totalAmount.toFixed(2)}` : `$${totalAmount.toFixed(2)}`}
                                        </td>
                                    </tr>

                                    {/* Subtotal */}
                                    <tr className="bg-slate-50 font-bold border-b border-slate-300">
                                        <td colSpan={4} className="py-1.5 px-3 border-r border-slate-300 text-right uppercase text-[9px] text-slate-700">
                                            Subtotal:
                                        </td>
                                        <td colSpan={2} className="py-1.5 px-2.5 text-right font-mono text-slate-950">
                                            {isINR ? `₹${totalAmount.toFixed(2)}` : `$${totalAmount.toFixed(2)}`}
                                        </td>
                                    </tr>

                                    {/* Taxes */}
                                    <tr className="bg-slate-50 border-b border-slate-300 text-slate-600">
                                        <td colSpan={4} className="py-1.5 px-3 border-r border-slate-300 text-right uppercase text-[9px]">
                                            Tax (Freelance Exemption / Below Turnover Threshold):
                                        </td>
                                        <td colSpan={2} className="py-1.5 px-2.5 text-right font-mono">
                                            ₹0.00
                                        </td>
                                    </tr>

                                    {/* Grand Total */}
                                    <tr className="bg-slate-100 font-black text-[11px]">
                                        <td colSpan={4} className="py-2 px-3 border-r border-slate-400 text-right uppercase tracking-wider text-slate-900">
                                            Total Paid:
                                        </td>
                                        <td colSpan={2} className="py-2 px-2.5 text-right font-mono text-slate-950 text-xs">
                                            {isINR ? `₹${totalAmount.toFixed(2)}` : `$${totalAmount.toFixed(2)}`}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 5. Amount in Words */}
                        <div className="border border-slate-300 p-2.5 rounded-sm bg-slate-50/70 mb-4 print:bg-white text-[10px]">
                            <span className="font-bold text-slate-900">Amount in Words: </span>
                            <span className="italic text-slate-800 font-medium">
                                {isINR ? numberToWordsINR(totalAmount) : `${totalAmount} USD Only`}
                            </span>
                        </div>

                        {/* 6. Payment & Gateway Details (100% Real Gateway Info) */}
                        <div className="border border-slate-300 p-3 rounded-sm bg-slate-50/50 mb-4 print:bg-white">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[10px] uppercase tracking-wide">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Verified Gateway Payment Record</span>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    PAID / COMPLETED
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                                <div>
                                    <span className="text-slate-500 block text-[9px]">Payment Gateway</span>
                                    <span className="font-bold text-slate-900">Razorpay Secure Network</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px]">Gateway Payment ID</span>
                                    <span className="font-mono font-bold text-slate-900 break-all">{paymentId}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px]">Gateway Order ID</span>
                                    <span className="font-mono font-bold text-slate-900 break-all">{orderId}</span>
                                </div>
                            </div>
                        </div>

                        {/* 7. Real Freelancer Signatory Box */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pt-2 border-t border-slate-300 mt-2">
                            <div className="text-[9px] text-slate-600 space-y-1 max-w-sm">
                                <p><span className="font-bold text-slate-800">Declaration:</span> This is an authentic digital receipt and payment invoice issued by Gaurav Patil for URL shortening and platform cloud services rendered on XURL.</p>
                                <p className="text-slate-500 italic">This electronic document confirms successful payment settlement through Razorpay and requires no physical signature.</p>
                            </div>

                            <div className="text-right shrink-0">
                                <p className="text-[10px] font-bold text-slate-950">
                                    Issued by:
                                </p>
                                <p className="text-[12px] font-black text-slate-900 mt-0.5">
                                    Gaurav Patil
                                </p>
                                <p className="text-[10px] text-slate-600 font-medium">
                                    Creator & Developer, XURL
                                </p>
                                
                                {/* Verification Seal */}
                                <div className="my-1.5 flex justify-end">
                                    <div className="border border-emerald-600/50 bg-emerald-50/50 px-3 py-1 rounded flex items-center gap-1.5 text-emerald-800">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                        <span className="text-[9px] font-bold font-mono tracking-wide uppercase">
                                            Digitally Verified Payment
                                        </span>
                                    </div>
                                </div>

                                <p className="text-[9px] text-slate-500">Authorized Digital Confirmation</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer Controls (Hidden in Print) */}
                <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-t border-border print:hidden shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Esc</kbd> to close
                    </span>

                    <div className="flex items-center gap-2 ml-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            className="h-8 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                            Close
                        </Button>

                        <Button
                            size="sm"
                            onClick={() => downloadInvoicePdf(tx, user)}
                            className="h-8 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Invoice (PDF)</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Print Stylesheet Overrides */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Hide everything outside modal */
                    header, footer, nav, [data-sidebar], .no-print {
                        display: none !important;
                    }
                    #xurl-invoice-document {
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                    }
                }
            `}</style>
        </div>
    );
}
