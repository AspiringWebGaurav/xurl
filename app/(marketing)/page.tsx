"use client";

import { motion } from "framer-motion";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Workspace } from "@/components/layout/Workspace";
import { Button } from "@/components/ui/button";
import { Link2, Zap, Lock, BarChart2 } from "lucide-react";
import Link from "next/link";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" }
  })
};

export default function LandingPage() {
  return (
    <div className="flex h-full w-full flex-col">
      <TopNavbar />
      <Workspace className="flex flex-col items-center justify-center p-8 bg-dot-pattern">

        <div className="max-w-3xl text-center space-y-8 relative z-10">
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 shadow-sm"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            XURL 1.0 is now live
          </motion.div>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="text-5xl md:text-6xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-zinc-50 to-zinc-400"
          >
            SaaS Link Management <br /> Reimagined.
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed"
          >
            Experience a desktop-grade platform for managing, tracking, and shortening your URLs with millisecond latency.
          </motion.p>

          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="flex items-center justify-center gap-4 pt-4"
          >
            <Button size="lg" className="rounded-full shadow-lg h-12 px-8" asChild>
              <Link href="/register">Start for free</Link>
            </Button>
            <Button size="lg" variant="secondary" className="rounded-full h-12 px-8 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </motion.div>
        </div>

        {/* Features Grid */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-4xl w-full z-10"
        >
          <FeatureCard
            icon={<Zap className="h-5 w-5 text-zinc-300" />}
            title="Millisecond Latency"
            description="Our edge network ensures your links redirect instantly worldwide."
          />
          <FeatureCard
            icon={<BarChart2 className="h-5 w-5 text-zinc-300" />}
            title="Real-time Analytics"
            description="Track clicks, referrers, and geography with beautiful visual dashboards."
          />
          <FeatureCard
            icon={<Lock className="h-5 w-5 text-zinc-300" />}
            title="Enterprise Security"
            description="Custom domains, password protection, and granular access controls."
          />
        </motion.div>

        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />

      </Workspace>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-zinc-950/50 border border-zinc-900 backdrop-blur-sm transition-colors hover:bg-zinc-900/50">
      <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <h3 className="font-medium text-zinc-200">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}
