# Multi-User Implementation Roadmap

**Status:** Planning Phase  
**Priority:** Phase 1 Ready to Start  
**Estimated Timeline:** 4 weeks (can be compressed)

---

## 🎯 High-Level Roadmap

```
Week 1: Authentication Foundation
├─ Day 1-2: Firebase Auth setup + Google OAuth
├─ Day 3: User profiles & roles in Firestore
└─ Day 4-5: Firestore security rules & UI

Week 2: Dev/Prod Separation
├─ Day 1: Analyze current data structure
├─ Day 2-3: Create dev collections & migration
├─ Day 4: Update all services (collections.ts)
└─ Day 5: UI toggle & environment context

Week 3: Multi-User Isolation
├─ Day 1-2: Add clientId/userId filters to queries
├─ Day 3: Permission checks & authorization
├─ Day 4: Multi-user testing
└─ Day 5: Bug fixes & refinement

Week 4: Polish & Launch Prep
├─ Day 1-2: Sync/promotion system
├─ Day 3: Performance optimization
├─ Day 4-5: Full testing & documentation
```

---

## 📋 Phase 1: Authentication Foundation (Days 1-5)

### Goal
Users can log in with Google, profiles are created, roles are assigned, basic security rules are in place.

### Tasks

#### Task 1.1: Set Up Firebase Authentication
**Estimated Time:** 2 hours

```bash
# 1. Enable Google Sign-In in Firebase Console
# Go to: https://console.firebase.google.com
# Navigate: performancecoachapp-26bd1 → Authentication → Sign-in method
# Enable: Google

# 2. Update .env.local with your OAuth credentials (already done)
GOOGLE_CLIENT_ID=220447477156-i7mis4i6nfqa5ag8ud2c0943t11ns98m.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
```

**Checklist:**
- [ ] Google Sign-in enabled in Firebase Console
- [ ] OAuth credentials verified in .env
- [ ] OAuth redirect URIs include all deployment URLs

---

#### Task 1.2: Create Authentication Context & Hooks
**Estimated Time:** 3-4 hours  
**Files to Create:**

```typescript
// src/lib/context/AuthContext.tsx
import React, { createContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithPopup, 
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  Auth 
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      
      // Create user profile in Firestore (see Task 1.3)
      await createUserProfile(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-out failed');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

```typescript
// src/lib/hooks/useAuth.ts
import { useContext } from 'react';
import { AuthContext } from '@/lib/context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

#### Task 1.3: Create User Profile System
**Estimated Time:** 2-3 hours  
**Files to Create:**

```typescript
// src/lib/types/user.ts
import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'coach' | 'client';
export type Environment = 'dev' | 'prod';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  
  // Admin-specific
  isAdmin: boolean;
  canAccessDev: boolean;
  
  // Coach/Client-specific
  assignedCoach?: string;  // UID of your account if they're a client
  
  // Settings
  canSyncCalendars: boolean;
  timezone?: string;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSignIn: Timestamp;
}
```

```typescript
// src/lib/firebase/services/userProfile.ts
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  Timestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { getDb } from '@/lib/firebase/config';
import { UserProfile, UserRole } from '@/lib/types/user';

const COLLECTION = 'users';

/**
 * Create or update user profile
 */
export async function createUserProfile(
  authUser: User,
  role: UserRole = 'coach'
): Promise<UserProfile> {
  const now = Timestamp.now();
  
  const profile: UserProfile = {
    uid: authUser.uid,
    email: authUser.email || '',
    displayName: authUser.displayName || 'User',
    photoURL: authUser.photoURL || undefined,
    role,
    isAdmin: role === 'admin',
    canAccessDev: role === 'admin',
    canSyncCalendars: true,
    createdAt: now,
    updatedAt: now,
    lastSignIn: now,
  };

  const userRef = doc(getDb(), COLLECTION, authUser.uid);
  const existingDoc = await getDoc(userRef);
  
  if (existingDoc.exists()) {
    // Update last sign-in
    await updateDoc(userRef, {
      lastSignIn: now,
    });
    return { ...existingDoc.data() as UserProfile, lastSignIn: now };
  }
  
  // Create new profile
  await setDoc(userRef, profile);
  return profile;
}

/**
 * Get user profile
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(getDb(), COLLECTION, uid);
  const docSnap = await getDoc(userRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return docSnap.data() as UserProfile;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>
): Promise<void> {
  const userRef = doc(getDb(), COLLECTION, uid);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  const q = query(collection(getDb(), COLLECTION));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as UserProfile);
}

/**
 * Get coaches (admin only)
 */
export async function getCoaches(): Promise<UserProfile[]> {
  const q = query(
    collection(getDb(), COLLECTION),
    where('role', '==', 'coach')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as UserProfile);
}
```

---

#### Task 1.4: Update Firestore Security Rules
**Estimated Time:** 2 hours  
**File:** `firestore.rules`

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return request.auth.uid == 'REPLACE_WITH_YOUR_UID';
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // User profiles
    match /users/{uid} {
      allow read: if isAuthenticated() && (isOwner(uid) || isAdmin());
      allow write: if isAdmin() || (isOwner(uid) && request.resource.data.role == resource.data.role);
      allow create: if isAuthenticated();
    }
    
    // Admin-only: Dev collections
    match /dev-{collection=**} {
      allow read, write: if isAdmin();
    }
    
    // Shared catalogs (read for authenticated, write for admin)
    match /movements/{doc=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    match /movementCategories/{doc=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    match /workoutTypes/{doc=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    match /workoutCategories/{doc=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // TODO: Add rules for other collections
    // For now, allow all authenticated users
    match /{document=**} {
      allow read, write: if isAuthenticated();
    }
  }
}
```

**Note:** Replace `REPLACE_WITH_YOUR_UID` with your actual Firebase Auth UID

---

#### Task 1.5: Create Login UI Components
**Estimated Time:** 3 hours

```typescript
// src/components/auth/LoginButton.tsx
'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader } from 'lucide-react';

export function LoginButton() {
  const { user, loading, signIn } = useAuth();

  if (loading) {
    return <Loader className="animate-spin" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-8 h-8 rounded-full"
          />
        )}
        <span>{user.displayName || user.email}</span>
      </div>
    );
  }

  return (
    <Button onClick={signIn}>
      Sign In with Google
    </Button>
  );
}
```

```typescript
// src/components/auth/LogoutButton.tsx
'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={logout}
    >
      <LogOut className="w-4 h-4" />
    </Button>
  );
}
```

```typescript
// src/components/auth/ProtectedRoute.tsx
'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'coach' | 'client';
}

export function ProtectedRoute({ 
  children, 
  requiredRole 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
```

---

#### Task 1.6: Update Root Layout with AuthProvider
**Estimated Time:** 1 hour

**File:** `src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { AuthProvider } from "@/lib/context/AuthContext";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// ... existing code ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const firebasePublicConfig = {
    // ... existing config ...
  };

  const firebasePublicConfigJson = JSON.stringify(firebasePublicConfig).replace(/</g, "\\u003c");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__FIREBASE_CONFIG__ = ${firebasePublicConfigJson};`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

#### Task 1.7: Create Simple Login Page
**Estimated Time:** 1 hour

```typescript
// src/app/login/page.tsx
'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { LoginButton } from '@/components/auth/LoginButton';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Performance Coach+</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <LoginButton />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Phase 1 Verification Checklist

Before moving to Phase 2, verify:

- [ ] Can sign in with Google
- [ ] User profile created in Firestore
- [ ] Protected routes redirect to login
- [ ] Logout works
- [ ] Firestore rules allow authenticated access
- [ ] Dev collections blocked for non-admin
- [ ] No console errors in browser
- [ ] Mobile login works

---

## 📋 Phase 2: Dev/Prod Separation (Days 6-10)

### Goal
Create separate dev/prod environments, migrate data, update services to support environment switching.

### Overview

This phase involves:
1. Creating dev-* collections from existing data
2. Building a collection name helper
3. Updating all services to use dynamic collection names
4. Adding environment context to UI
5. Creating migration utilities

### Key Decision Point

**Before starting Phase 2:**  
Decide: Are you keeping your current data in production, or moving it all to dev?

**Recommended:** Move all current data to dev-* collections, start fresh in production for new users.

---

## 🚀 Ready to Start?

**The strategy document and roadmap are complete.** 

Here's what I recommend:

### Next Steps:

1. **Review:** Read both documents carefully
2. **Decide:** 
   - Confirm "Collection Prefixing" (dev-*) vs "Metadata Field"
   - Decide about current data (keep in prod vs move to dev)
3. **Plan:**
   - Pick your Firebase Admin UID (get after first login)
   - Decide on user roles and initial coaches/clients
4. **Start Phase 1:**
   - I can implement all the authentication code
   - This is the foundation everything depends on

### Questions for You:

1. Should I go ahead and implement Phase 1 (Authentication)?
2. Do you want me to create all the component files, or just show the code?
3. What's your Firebase Admin UID? (Or should we get it after you first login?)
4. Should Phase 2 move existing data to dev-* or keep it in production?
5. Any other considerations or preferences?

---

*Document Status: COMPLETE - Ready for implementation*  
*Created: 2026-01-21*
