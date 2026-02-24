"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Activity, Server, Database, Clock } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';

interface HealthStatus {
    status: string;
    timestamp: string;
    service: string;
    environment?: string;
}

interface DependencyStatus {
    status: string;
    timestamp: string;
    service: string;
    dependencies: Record<string, {
        status: string;
        latency?: number;
        error?: string;
    }>;
}

export default function HealthDashboard() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [dependencies, setDependencies] = useState<DependencyStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const [healthRes, depsRes] = await Promise.all([
                    fetch('/api/health'),
                    fetch('/api/health/dependencies')
                ]);

                const healthData = await healthRes.json();
                const depsData = await depsRes.json();

                setHealth(healthData);
                setDependencies(depsData);
            } catch (error) {
                console.error('Failed to fetch health data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 30000); // Refresh every 30s

        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy':
                return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'degraded':
                return <AlertCircle className="h-5 w-5 text-yellow-500" />;
            case 'unhealthy':
                return <XCircle className="h-5 w-5 text-red-500" />;
            default:
                return <Activity className="h-5 w-5 text-gray-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
            healthy: { variant: "default", className: "bg-green-500 hover:bg-green-600" },
            degraded: { variant: "secondary", className: "bg-yellow-500 hover:bg-yellow-600" },
            unhealthy: { variant: "destructive", className: "" }
        };

        const config = variants[status] || variants.unhealthy;

        return (
            <Badge variant={config.variant} className={config.className}>
                {status.toUpperCase()}
            </Badge>
        );
    };

    if (loading) {
        return (
            <AuthGuard requireMaster>
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="animate-pulse space-y-4">
                            <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        </div>
                    </div>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard requireMaster>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <Activity className="h-10 w-10 text-blue-500" />
                                System Health Dashboard
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400 mt-2">
                                Real-time monitoring of application status and dependencies
                            </p>
                        </div>
                        {health && (
                            <div className="text-right">
                                <div className="text-sm text-slate-500 dark:text-slate-400">Last Updated</div>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {new Date(health.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Overall Status */}
                    {health && (
                        <Card className="border-2 shadow-lg">
                            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                        <span>Service Status</span>
                                    </div>
                                    {getStatusBadge(health.status)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        {getStatusIcon(health.status)}
                                        <div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400">Status</div>
                                            <div className="text-lg font-semibold capitalize text-slate-900 dark:text-white">
                                                {health.status}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <Database className="h-5 w-5 text-purple-500" />
                                        <div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400">Service</div>
                                            <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                                {health.service}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <Clock className="h-5 w-5 text-orange-500" />
                                        <div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400">Environment</div>
                                            <div className="text-lg font-semibold capitalize text-slate-900 dark:text-white">
                                                {health.environment || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Dependencies */}
                    {dependencies && (
                        <Card className="border-2 shadow-lg">
                            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                        <span>Dependencies</span>
                                    </div>
                                    {getStatusBadge(dependencies.status)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    {Object.entries(dependencies.dependencies).map(([name, dep]) => (
                                        <div
                                            key={name}
                                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border-l-4"
                                            style={{
                                                borderLeftColor: dep.status === 'healthy' ? '#10b981' :
                                                    dep.status === 'degraded' ? '#f59e0b' : '#ef4444'
                                            }}
                                        >
                                            <div className="flex items-center gap-3 flex-1">
                                                {getStatusIcon(dep.status)}
                                                <div className="flex-1">
                                                    <div className="font-semibold text-slate-900 dark:text-white capitalize">
                                                        {name.replace(/_/g, ' ')}
                                                    </div>
                                                    {dep.error && (
                                                        <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                            {dep.error}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {dep.latency !== undefined && (
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">Latency</div>
                                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                            {dep.latency}ms
                                                        </div>
                                                    </div>
                                                )}
                                                {getStatusBadge(dep.status)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Footer Info */}
                    <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                        Auto-refreshes every 30 seconds • Last check: {health && new Date(health.timestamp).toLocaleString()}
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
