"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Zap,
  Users,
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  Shield,
  Target,
  BarChart3,
  Clock,
  Sparkles
} from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { scrollY } = useScroll();
  const headerBg = useTransform(scrollY, [0, 100], ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.8)"]);
  const headerBorder = useTransform(scrollY, [0, 100], ["rgba(255, 255, 255, 0)", "rgba(0, 0, 0, 0.05)"]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Instantly redirect returning users to dashboard
        router.replace('/dashboard');
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/20 blur-xl rounded-full animate-pulse" />
            <Zap className="h-12 w-12 text-primary relative z-10 fill-primary/10" />
          </div>
          <p className="text-sm font-medium text-gray-400 uppercase tracking-widest">Preparing your experience</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen selection:bg-primary/20 overflow-x-hidden bg-gray-50/50">
      {/* --- Background Design System --- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {/* Animated Background Blur Glows - GPU Accelerated */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          style={{ willChange: "transform" }}
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, -60, 0],
            opacity: [0.15, 0.3, 0.15]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ willChange: "transform" }}
          className="absolute top-[5%] -right-[10%] w-[55%] h-[55%] bg-blue-400/10 rounded-full blur-[120px]"
        />

        {/* CSS Dot Patterns - Optimized for performance and visibility */}
        <div className="absolute inset-0 h-[5000px] w-full">
          {[
            { cx: "50%", cy: "400px", r: "700px", op: 0.28 },
            { cx: "10%", cy: "200px", r: "500px", op: 0.2 },
            { cx: "90%", cy: "1200px", r: "600px", op: 0.22 },
            { cx: "20%", cy: "1800px", r: "750px", op: 0.18 },
            { cx: "50%", cy: "2800px", r: "800px", op: 0.25 },
            { cx: "85%", cy: "3600px", r: "550px", op: 0.2 }
          ].map((circle, i) => (
            <motion.div
              key={i}
              initial={{ opacity: circle.op }}
              animate={{
                scale: [1, 1.03, 1],
                opacity: [circle.op, circle.op * 1.3, circle.op]
              }}
              transition={{
                duration: 12 + i * 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{
                position: "absolute",
                left: circle.cx,
                top: circle.cy,
                width: circle.r,
                height: circle.r,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle, #64748b 1.2px, transparent 1.2px)`,
                backgroundSize: "24px 24px",
                borderRadius: "100%",
                // Using a simpler blur instead of mask-image for better performance
                filter: "blur(0.5px)",
                // maskImage removed for iOS performance
                willChange: "transform, opacity"
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10">
        {/* Grain Overlay - Disabled for iOS Performance
        <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-multiply pointer-events-none -z-5" />
        */}

        {/* --- Header Navigation --- */}
        <motion.header
          style={{ backgroundColor: headerBg, borderBottomColor: headerBorder }}
          className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b transition-colors duration-300"
        >
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="bg-primary p-2 rounded-xl group-hover:scale-110 transition-transform shadow-lg shadow-primary/20">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900">
                Performance <span className="text-primary">Coach +</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-600">
              <a href="#features" className="hover:text-primary transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-primary transition-colors">How it Works</a>
              <Link href="/login" className="px-5 py-2.5 rounded-2xl bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-xl shadow-gray-200">
                Login
              </Link>
            </nav>
          </div>
        </motion.header>

        {/* --- Hero Section --- */}
        <section className="relative pt-40 pb-24 px-6">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-bold uppercase tracking-widest"
            >
              <Sparkles className="h-3 w-3" />
              The New Standard for Performance Coaching
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1]"
            >
              Coach Smarter. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
                Achieve More.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed"
            >
              The ultimate unified toolkit for elite coaches. Manage your roster,
              build world-class programming, and sync everything with Google Calendar.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/login">
                <Button className="h-16 px-10 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20 group">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="ghost" className="h-16 px-10 text-lg font-semibold rounded-2xl hover:bg-white/50 border border-transparent hover:border-gray-200 transition-all">
                  View Features
                </Button>
              </a>
            </motion.div>

            {/* Dashboard Preview Mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative mt-20 p-2 bg-white/40 backdrop-blur-sm border border-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]"
            >
              <div className="aspect-[16/9] bg-gray-900 rounded-[2rem] overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-blue-600/20 opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <LayoutDashboard className="h-20 w-20 text-white/10" />
                </div>
                {/* Representative elements */}
                <div className="absolute top-8 left-8 right-8 h-12 bg-white/10 rounded-xl flex items-center px-6 gap-4">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="absolute top-28 left-8 w-64 bottom-8 bg-white/5 rounded-2xl p-6 space-y-4">
                  <div className="h-4 w-32 bg-white/20 rounded-md" />
                  <div className="h-4 w-48 bg-white/10 rounded-md" />
                  <div className="h-4 w-40 bg-white/10 rounded-md" />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* --- Features Section --- */}
        <section id="features" className="py-24 px-6 relative">
          <div className="max-w-7xl mx-auto space-y-16 text-center">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
                Built for the Professional Workflow
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto">
                Everything you need to deliver elite-level results, all in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: Calendar,
                  title: "Unified Schedule",
                  color: "bg-blue-500",
                  desc: "Full Google Calendar two-way sync. Never double-book a session again."
                },
                {
                  icon: Target,
                  title: "Pro Builder",
                  color: "bg-primary",
                  desc: "The fastest workout architect on the market. Drag, drop, and deploy."
                },
                {
                  icon: Users,
                  title: "Client Insights",
                  color: "bg-emerald-500",
                  desc: "Track progress, volume, and adherence with deep visual analytics."
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 bg-white/60 backdrop-blur-md border border-white rounded-[2rem] hover:shadow-2xl hover:shadow-primary/10 transition-all text-left space-y-4 group"
                >
                  <div className={`${feature.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{feature.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* --- Trust / Proof Section --- */}
        <section className="py-12 border-y border-gray-100 bg-white/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-center justify-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all">
              <div className="flex items-center gap-2 font-bold text-2xl"><Shield className="h-6 w-6" /> DATA SECURE</div>
              <div className="flex items-center gap-2 font-bold text-2xl"><Clock className="h-6 w-6" /> REALTIME SYNC</div>
              <div className="flex items-center gap-2 font-bold text-2xl"><BarChart3 className="h-6 w-6" /> ANALYTICS PRO</div>
            </div>
          </div>
        </section>

        {/* --- CTA Section --- */}
        <section className="py-24 px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto bg-gray-900 p-12 md:p-20 rounded-[3rem] text-white relative overflow-hidden shadow-3xl shadow-primary/20"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-transparent to-blue-600/30 opacity-40" />
            <div className="relative z-10 space-y-8">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                Ready to Elevate Your Coaching?
              </h2>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">
                Join elite coaches using Performance Coach Plus to streamline their workflow.
              </p>
              <Link href="/login">
                <Button className="h-16 px-12 text-lg font-bold rounded-2xl bg-white text-black hover:bg-gray-100 transition-all shadow-xl group">
                  Start Your Journey
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* --- Footer --- */}
        <footer className="py-12 px-6 border-t border-gray-100">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-bold text-gray-900">Performance Coach +</span>
            </div>
            <div className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} Performance Coach Plus. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-sm font-medium text-gray-500">
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
              <a href="#" className="hover:text-primary transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}