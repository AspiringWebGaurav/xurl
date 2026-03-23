import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Open Source",
    description:
        "XURL is open-source software released under the MIT License. Learn about the project, how to contribute, and the freedoms the license grants.",
    alternates: { canonical: `${seo.url}/open-source` },
    openGraph: {
        title: "Open Source — XURL",
        description:
            "XURL is open-source under the MIT License. View the source, contribute, and build on top of it.",
        url: `${seo.url}/open-source`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

const sections = [
    {
        title: "Overview",
        content: (
            <p>XURL is open-source software. The entire codebase — frontend, backend, edge middleware, and infrastructure configuration — is publicly available and released under the <strong>MIT License</strong>.</p>
        ),
    },
    {
        title: "MIT License",
        content: (
            <>
                <p>Copyright &copy; 2026 Gaurav Patil</p>
                <p>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the &ldquo;Software&rdquo;), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:</p>
                <p>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.</p>
                <p>THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</p>
            </>
        ),
    },
    {
        title: "What This Means",
        content: (
            <>
                <ul>
                    <li><strong>Use</strong> — You can use XURL for any purpose, commercial or personal.</li>
                    <li><strong>Modify</strong> — You can change the source code to suit your needs.</li>
                    <li><strong>Distribute</strong> — You can share copies of the original or modified code.</li>
                    <li><strong>Sublicense</strong> — You can include XURL in proprietary projects.</li>
                    <li><strong>Private use</strong> — You can use and modify XURL privately without publishing changes.</li>
                </ul>
                <p>The only requirement is that you include the original copyright notice and license text in any copies or substantial portions of the Software.</p>
            </>
        ),
    },
    {
        title: "Source Code",
        content: (
            <p>The full source code is available on GitHub: <a href="https://github.com/AspiringWebGaurav/xurl" target="_blank" rel="noopener noreferrer">github.com/AspiringWebGaurav/xurl</a></p>
        ),
    },
    {
        title: "Contributing",
        content: (
            <p>Contributions are welcome. Fork the repository, create a feature branch, and open a pull request against <code>main</code>. Please ensure <code>npm run lint</code> and <code>npm run build</code> pass before submitting. For detailed guidelines, see the <a href="https://github.com/AspiringWebGaurav/xurl#contributing" target="_blank" rel="noopener noreferrer">Contributing section</a> in the README.</p>
        ),
    },
    {
        title: "Third-Party Licenses",
        content: (
            <>
                <p>XURL depends on open-source libraries, each governed by their own licenses:</p>
                <ul>
                    <li><strong>Next.js</strong> — MIT</li>
                    <li><strong>React</strong> — MIT</li>
                    <li><strong>Tailwind CSS</strong> — MIT</li>
                    <li><strong>shadcn/ui</strong> — MIT</li>
                    <li><strong>Framer Motion</strong> — MIT</li>
                    <li><strong>Firebase SDK</strong> — Apache 2.0</li>
                    <li><strong>Upstash Redis</strong> — MIT</li>
                    <li><strong>Zod</strong> — MIT</li>
                </ul>
                <p>Full dependency information is available in the <code>package.json</code> file in the repository root.</p>
            </>
        ),
    },
    {
        title: "Reporting Security Issues",
        content: (
            <p>If you discover a security vulnerability, please report it responsibly by opening a private issue on GitHub or contacting the maintainer directly. Do not disclose vulnerabilities publicly until a fix has been released.</p>
        ),
    },
];

export default function OpenSourcePage() {
    return (
        <LegalPageShell
            title="Open Source"
            sections={sections}
        />
    );
}
