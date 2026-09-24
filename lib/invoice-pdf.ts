import jsPDF from "jspdf";
import { format } from "date-fns";
import type { InvoiceTransaction, InvoiceUser } from "@/components/payments/XurlInvoiceModal";

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

/**
 * Builds the official PDF invoice using jsPDF vector graphics
 */
export function buildInvoicePdf(tx: InvoiceTransaction, user?: InvoiceUser | null): jsPDF {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const isINR = (tx.currency || "INR").toUpperCase() === "INR";
    const totalAmount = (tx.amount ?? 100) / 100;
    const currencySymbol = isINR ? "Rs." : "$";

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
        ? "Includes 1,000,000 Banked Permanent Links, 1M API Quota, Custom Aliases & Analytics."
        : `Includes ${tx.linksAllocated ? tx.linksAllocated.toLocaleString() : "unlimited"} short links & API integration.`;

    const left = 14;
    const right = 196;
    const width = right - left;

    // --- 1. Top Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("xurl", left, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text("Gaurav Patil | Freelance Software Developer & Creator of XURL", left, 25.5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Website: gauravpatil.site  |  Contact Email: hello@gauravpatil.site  |  Direct: gauravpatil9262@gmail.com", left, 29.5);

    // Right Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text("INVOICE & PAYMENT RECEIPT", right, 20, { align: "right" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("(Original for Recipient)", right, 25, { align: "right" });

    // Header Divider
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.line(left, 32, right, 32);

    // --- 2. Provider & Customer Box ---
    let y = 36;
    const boxH = 38;
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setLineWidth(0.2);
    doc.rect(left, y, width, boxH, "FD");

    // Divider down the middle
    const midX = left + width / 2;
    doc.line(midX, y, midX, y + boxH);

    // Left: Provider
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text("ISSUED BY (SERVICE PROVIDER):", left + 3.5, y + 4.8);

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Gaurav Patil", left + 3.5, y + 9.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text("Freelance Software Engineer & Creator of XURL", left + 3.5, y + 13.8);

    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Website: gauravpatil.site", left + 3.5, y + 18);
    doc.text("Contact Email: hello@gauravpatil.site", left + 3.5, y + 22);
    doc.text("Reach Out / Direct: gauravpatil9262@gmail.com", left + 3.5, y + 26);
    doc.text("Location: Maharashtra, India", left + 3.5, y + 30);
    doc.text("Tax Status: Freelance Services (Below GST Threshold)", left + 3.5, y + 34);

    // Right: Customer
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("BILLED TO (CUSTOMER DETAILS):", midX + 3.5, y + 4.8);

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(customerName, midX + 3.5, y + 9.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`Email: ${customerEmail}`, midX + 3.5, y + 13.8);
    doc.text(`Account UID: ${tx.userId || "N/A"}`, midX + 3.5, y + 18);

    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Delivery: Instant Digital Cloud Provisioning", midX + 3.5, y + 22);
    doc.text("Service: Online URL Management Platform", midX + 3.5, y + 26);
    doc.text("Payment Status: FULLY SETTLED / COMPLETED", midX + 3.5, y + 30);

    // --- 3. Order & Invoice Meta Strip ---
    y += boxH + 3.5;
    const metaH = 12;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(left, y, width, metaH, "FD");

    const metaCols = [
        { label: "GATEWAY ORDER ID", val: orderId, w: 45 },
        { label: "TRANSACTION DATE", val: formattedDateTime, w: 46 },
        { label: "INVOICE / RECEIPT NO", val: invoiceNumber, w: 56 },
        { label: "ISSUE DATE", val: formattedDate, w: 35 }
    ];

    let curMetaX = left;
    metaCols.forEach((item) => {
        const itemX = curMetaX + 2.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(item.label, itemX, y + 4.2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(item.val.length > 24 ? 6.8 : 7.5);
        doc.setTextColor(15, 23, 42);
        const textVal = doc.splitTextToSize(item.val, item.w - 5);
        doc.text(textVal, itemX, y + 8.5);

        curMetaX += item.w;
    });

    // --- 4. Services Table ---
    y += metaH + 4;
    const thH = 8;
    doc.setFillColor(241, 245, 249);
    doc.rect(left, y, width, thH, "FD");

    // Table Columns:
    // SI (12), Description (88), Category (26), Qty (14), Unit Rate (22), Total (20)
    const c1 = left;
    const c2 = c1 + 12;
    const c3 = c2 + 88;
    const c4 = c3 + 26;
    const c5 = c4 + 14;
    const c6 = c5 + 22;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text("SI. No", c1 + 6, y + 5.5, { align: "center" });
    doc.text("Description & Service Scope", c2 + 3, y + 5.5);
    doc.text("Category", c3 + 13, y + 5.5, { align: "center" });
    doc.text("Qty", c4 + 7, y + 5.5, { align: "center" });
    doc.text("Unit Rate", c5 + 20, y + 5.5, { align: "right" });
    doc.text("Total", right - 2, y + 5.5, { align: "right" });

    // Table Row
    y += thH;
    const rowH = 18;
    doc.rect(left, y, width, rowH, "D");

    // Column divider lines
    [c2, c3, c4, c5, c6].forEach(lineX => {
        doc.line(lineX, y, lineX, y + rowH);
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("1", c1 + 6, y + 6, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.text(planTitle, c2 + 3, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(planDescription, c2 + 3, y + 9.5);
    doc.text(`Ref: ${tx.id} | Action: ${tx.action}`, c2 + 3, y + 13.5);

    doc.text("Digital SaaS", c3 + 13, y + 6, { align: "center" });
    doc.text("1", c4 + 7, y + 6, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(`${currencySymbol}${totalAmount.toFixed(2)}`, c5 + 20, y + 6, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text(`${currencySymbol}${totalAmount.toFixed(2)}`, right - 2, y + 6, { align: "right" });

    // Subtotal Row
    y += rowH;
    const subH = 7;
    doc.setFillColor(248, 250, 252);
    doc.rect(left, y, width, subH, "FD");
    doc.line(c5, y, c5, y + subH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("SUBTOTAL:", c5 - 4, y + 4.8, { align: "right" });

    doc.setTextColor(15, 23, 42);
    doc.text(`${currencySymbol}${totalAmount.toFixed(2)}`, right - 2, y + 4.8, { align: "right" });

    // Tax Exemption Row
    y += subH;
    const taxH = 7;
    doc.rect(left, y, width, taxH, "D");
    doc.line(c5, y, c5, y + taxH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("TAX (FREELANCE EXEMPTION / BELOW TURNOVER THRESHOLD):", c5 - 4, y + 4.8, { align: "right" });

    doc.text(`${currencySymbol}0.00`, right - 2, y + 4.8, { align: "right" });

    // Total Paid Row
    y += taxH;
    const totH = 8.5;
    doc.setFillColor(241, 245, 249);
    doc.rect(left, y, width, totH, "FD");
    doc.line(c5, y, c5, y + totH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("TOTAL PAID:", c5 - 4, y + 5.8, { align: "right" });

    doc.setFontSize(9.5);
    doc.text(`${currencySymbol}${totalAmount.toFixed(2)}`, right - 2, y + 5.8, { align: "right" });

    // --- 5. Amount in Words Box ---
    y += totH + 3.5;
    const wordsH = 8;
    doc.setFillColor(248, 250, 252);
    doc.rect(left, y, width, wordsH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Amount in Words: ", left + 3.5, y + 5.2);

    const wordsText = isINR ? numberToWordsINR(totalAmount) : `${totalAmount} USD Only`;
    doc.setFont("helvetica", "italic");
    doc.setTextColor(51, 65, 85);
    doc.text(wordsText, left + 29, y + 5.2);

    // --- 6. Verified Gateway Payment Record ---
    y += wordsH + 3.5;
    const payH = 18;
    doc.setFillColor(248, 250, 252);
    doc.rect(left, y, width, payH, "FD");

    // Vector checkmark
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.4);
    doc.line(left + 3.5, y + 3.3, left + 4.7, y + 4.6);
    doc.line(left + 4.7, y + 4.6, left + 6.6, y + 1.8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text("VERIFIED GATEWAY PAYMENT SETTLEMENT", left + 8.5, y + 5);

    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text("STATUS: PAID / COMPLETED", right - 3.5, y + 5, { align: "right" });

    doc.line(left, y + 7, right, y + 7);

    const pColW = width / 3;
    const pItems = [
        { label: "PAYMENT GATEWAY", val: "Razorpay Secure Network" },
        { label: "GATEWAY PAYMENT ID", val: paymentId },
        { label: "GATEWAY ORDER ID", val: orderId }
    ];

    pItems.forEach((pi, idx) => {
        const px = left + idx * pColW + 3.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(pi.label, px, y + 11.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(pi.val, px, y + 15.5);
    });

    // --- 7. Signatory & Declaration Box ---
    y += payH + 5;
    doc.setDrawColor(203, 213, 225);
    doc.line(left, y, right, y);

    // Left declaration
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const decl1 = "Declaration: This is an authentic digital receipt and payment invoice issued by Gaurav Patil for URL shortening and platform cloud services rendered on XURL.";
    const decl2 = "This electronic document confirms successful payment settlement through Razorpay and requires no physical signature.";
    doc.text(doc.splitTextToSize(decl1, 105), left, y + 4.5);
    doc.text(doc.splitTextToSize(decl2, 105), left, y + 10.5);

    // Right signatory
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Issued by:", right, y + 4.5, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Gaurav Patil", right, y + 9, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Creator & Developer, XURL", right, y + 12.5, { align: "right" });

    // Official Verification Badge Box (Pure vector graphics, 100% immune to font bugs & cutoff)
    const badgeW = 46;
    const badgeH = 5.6;
    const badgeX = right - badgeW; // exactly ends at right (196mm)
    const badgeY = y + 14.2;

    doc.setDrawColor(16, 185, 129); // emerald-500
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setLineWidth(0.2);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, "FD");

    // Vector checkmark inside badge
    doc.setDrawColor(5, 150, 105); // emerald-600
    doc.setLineWidth(0.4);
    doc.line(badgeX + 2.8, badgeY + 2.9, badgeX + 4.1, badgeY + 4.2);
    doc.line(badgeX + 4.1, badgeY + 4.2, badgeX + 6.2, badgeY + 1.5);

    // Pure ASCII text inside badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text("DIGITALLY VERIFIED PAYMENT", badgeX + 7.6, badgeY + 3.9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("Authorized Digital Confirmation", right, y + 22.5, { align: "right" });

    return doc;
}

/**
 * Triggers an immediate client-side PDF file download
 */
export function downloadInvoicePdf(tx: InvoiceTransaction, user?: InvoiceUser | null): void {
    const doc = buildInvoicePdf(tx, user);
    const invoiceNumber = `IN-2026-${tx.id.toUpperCase()}`;
    doc.save(`Invoice_${invoiceNumber}_XURL.pdf`);
}
