import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Code of Conduct",
    description: "XURL Code of Conduct: guidelines for community behavior, prohibited activities, and enforcement.",
    alternates: { canonical: `${seo.url}/code-of-conduct` },
    openGraph: {
        title: "Code of Conduct — XURL",
        description: "Read the XURL Code of Conduct.",
        url: `${seo.url}/code-of-conduct`,
    },
};

const sections = [
    {
        title: "Our Pledge",
        content: (
            <p>We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.</p>
        ),
    },
    {
        title: "Our Standards",
        content: (
            <>
                <p>Examples of behavior that contributes to a positive environment include:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2 mb-4">
                    <li>Demonstrating empathy and kindness toward other people</li>
                    <li>Being respectful of differing opinions, viewpoints, and experiences</li>
                    <li>Giving and gracefully accepting constructive feedback</li>
                    <li>Accepting responsibility and apologizing to those affected by our mistakes, and learning from the experience</li>
                    <li>Focusing on what is best not just for us as individuals, but for the overall community</li>
                </ul>
                <p>Examples of unacceptable behavior include:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                    <li>The use of sexualized language or imagery, and sexual attention or advances of any kind</li>
                    <li>Trolling, insulting or derogatory comments, and personal or political attacks</li>
                    <li>Public or private harassment</li>
                    <li>Publishing others' private information, such as a physical or email address, without their explicit permission</li>
                    <li>Other conduct which could reasonably be considered inappropriate in a professional setting</li>
                </ul>
            </>
        ),
    },
    {
        title: "Prohibited Content & Actions",
        id: "prohibited",
        content: (
            <p>You may not use XURL to distribute malware, host phishing campaigns, conduct denial of service attacks, distribute child sexual abuse material (CSAM), or share illegal content. Any links found to be in violation of these strict prohibitions will be immediately terminated, and the offending user account will be permanently banned. Repeated violations from a specific network or device will result in IP-level and device-level blacklisting.</p>
        ),
    },
    {
        title: "Enforcement Responsibilities",
        content: (
            <p>Community leaders are responsible for clarifying and enforcing our standards of acceptable behavior and will take appropriate and fair corrective action in response to any behavior that they deem inappropriate, threatening, offensive, or harmful.</p>
        ),
    },
    {
        title: "Scope",
        content: (
            <p>This Code of Conduct applies within all community spaces, and also applies when an individual is officially representing the community in public spaces. Examples of representing our community include using an official e-mail address, posting via an official social media account, or acting as an appointed representative at an online or offline event.</p>
        ),
    },
];

export default function CodeOfConductPage() {
    return (
        <LegalPageShell
            title="Code of Conduct"
            lastUpdated="Last Updated: July 17, 2026 (Originally Published: July 16, 2026)"
            sections={sections}
        />
    );
}
