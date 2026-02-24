"use client";

import { useAuth } from '@/components/Providers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, Calendar, LogOut } from 'lucide-react';
import { auth } from '@/lib/config';

export default function ProfilePage() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center">
                <h2 className="text-2xl font-bold mb-4">Not Signed In</h2>
                <p className="text-muted-foreground mb-4">Please sign in to view your profile.</p>
            </div>
        );
    }

    const handleSignOut = async () => {
        try {
            await auth.signOut();
            window.location.href = '/login';
        } catch (error) {
            console.error('Failed to sign out', error);
        }
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your Profile</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="col-span-full md:col-span-2">
                    <CardHeader>
                        <CardTitle>Account Information</CardTitle>
                        <CardDescription>
                            Manage your connected account details and preferences.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center space-x-4">
                            <div className="h-20 w-20 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                                {user.photoURL ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={user.photoURL}
                                        alt="Profile"
                                        className="h-full w-full object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <User className="h-10 w-10 text-muted-foreground" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-xl font-medium">{user.displayName || 'Coach'}</h3>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Email Address</span>
                                </div>
                                <span className="text-sm text-muted-foreground">{user.email}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 text-sm">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Account Created</span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Unknown'}
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <Button variant="destructive" onClick={handleSignOut} className="w-full sm:w-auto">
                                <LogOut className="mr-2 h-4 w-4" />
                                Sign Out
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
