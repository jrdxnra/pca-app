"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged
} from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toastSuccess, toastError } from '@/components/ui/toaster';
import { CalendarClock, CheckCircle2, Loader2, Sparkles, Activity, ShieldCheck, Zap } from 'lucide-react';
import app from '@/lib/firebase/config';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [authInitialized, setAuthInitialized] = useState(false);

    // Check if already signed in
    useEffect(() => {
        const auth = getAuth(app);
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthInitialized(true);
            if (user) {
                // Already signed in, redirect to dashboard
                router.push('/dashboard');
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        try {
            const auth = getAuth(app);
            const provider = new GoogleAuthProvider();

            // CRITICAL: Request Calendar scopes here to enable "One Click" flow
            provider.addScope('https://www.googleapis.com/auth/calendar');

            // Request offline access to get a Refresh Token (needed for background server operations)
            provider.setCustomParameters({
                access_type: 'offline',
                prompt: 'consent', // Force consent prompt to ensure we get a refresh token
            });

            const result = await signInWithPopup(auth, provider);

            // This gives you a Google Access Token. You can use it to access the Google API.
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const accessToken = credential?.accessToken;
            const user = result.user;

            if (accessToken) {
                // Get the ID token to authenticate with our backend
                const idToken = await user.getIdToken();

                // Try to get the Refresh Token (tricky with Firebase)
                const refreshToken = (result as any)._tokenResponse?.oauthRefreshToken;

                // Save tokens to our backend
                await fetch('/api/auth/save-tokens', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        accessToken,
                        refreshToken,
                        idToken
                    }),
                });

                toastSuccess('Signed in & Calendar connected!');
            }

            // Redirect to dashboard
            router.push('/dashboard');

        } catch (error: any) {
            console.error('Sign in error:', error);

            if (error.code === 'auth/popup-closed-by-user') {
                toastError('Sign in cancelled');
            } else {
                toastError('Failed to sign in. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!authInitialized) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gray-50/50">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        rotate: [0, 90, 0],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[60px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, -60, 0],
                        opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[5%] -right-[10%] w-[55%] h-[55%] bg-blue-400/20 rounded-full blur-[60px]"
                />
                <motion.div
                    animate={{
                        y: [0, -60, 0],
                        x: [0, 30, 0],
                        opacity: [0.15, 0.3, 0.15]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-[0%] left-[10%] w-[50%] h-[50%] bg-purple-400/20 rounded-full blur-[60px]"
                />
            </div>

            {/* Dot Pattern Background (Circles created from dots) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <svg className="absolute inset-0 h-full w-full opacity-[0.8]" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="dot-pattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1.2" fill="#64748b" /> {/* text-slate-500 */}
                        </pattern>
                    </defs>

                    {/* Concentric circles made of dots by filling with pattern */}
                    <motion.circle
                        cx="50%" cy="50%" r="350"
                        fill="url(#dot-pattern)"
                        animate={{
                            scale: [1, 1.05, 1],
                            opacity: [0.3, 0.5, 0.3],
                            rotate: [0, 5, 0]
                        }}
                        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.circle
                        cx="15%" cy="15%" r="220"
                        fill="url(#dot-pattern)"
                        animate={{
                            scale: [0.9, 1.1, 0.9],
                            opacity: [0.2, 0.4, 0.2],
                            rotate: [0, -8, 0]
                        }}
                        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.circle
                        cx="85%" cy="85%" r="280"
                        fill="url(#dot-pattern)"
                        animate={{
                            scale: [1.1, 0.9, 1.1],
                            opacity: [0.15, 0.35, 0.15],
                            rotate: [0, 10, 0]
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    />
                </svg>
            </div>

            {/* Noise Overlay - Disabled for performance on iOS 
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-multiply pointer-events-none" />
            */}
            <div className="absolute inset-0 bg-grid-black/[0.015] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[440px] px-6"
            >
                <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                    <div className="p-8 pb-4">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                className="relative group"
                            >
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative bg-white w-16 h-16 rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm">
                                    <Zap className="text-primary w-8 h-8 fill-primary/10" />
                                </div>
                            </motion.div>

                            <div className="space-y-2">
                                <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center justify-center gap-2">
                                    Performance <span className="text-primary">Coach +</span>
                                </h1>
                                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                                    The ultimate toolkit for performance coaches. Manage, build, and track like a pro.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-8 space-y-6">
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { icon: CalendarClock, label: "Schedule", color: "text-blue-500" },
                                { icon: Activity, label: "Performance", color: "text-emerald-500" },
                                { icon: ShieldCheck, label: "Secure", color: "text-primary" }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.3 + (i * 0.1) }}
                                    className="flex flex-col items-center gap-2 p-3 bg-gray-50/50 border border-gray-100 rounded-2xl"
                                >
                                    <item.icon className={`h-5 w-5 ${item.color}`} />
                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">{item.label}</span>
                                </motion.div>
                            ))}
                        </div>

                        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-primary/80 leading-relaxed font-medium">
                                Experience seamless Google Calendar integration. Your schedule, perfectly synced.
                            </p>
                        </div>
                    </div>

                    <div className="p-8 pt-6">
                        <Button
                            className="w-full h-14 text-base font-semibold bg-gray-900 text-white hover:bg-gray-800 rounded-2xl transition-all duration-300 shadow-xl shadow-gray-200 active:scale-[0.98]"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                    Continue with Google
                                </>
                            )}
                        </Button>
                        <p className="text-center mt-6 text-gray-400 text-[11px] uppercase tracking-widest font-bold">
                            Professional Access Only
                        </p>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-8 text-center"
                >
                    <p className="text-gray-400 text-xs font-medium">
                        &copy; {new Date().getFullYear()} Performance Coach Plus. All rights reserved.
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
}
