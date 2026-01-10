# Pre-Production Deployment Checklist

## Current Status: Development Phase ✅

### Security Rules
- ✅ Firestore rules extended to Dec 31, 2026
- ✅ Open access for development (no auth required)
- ⏳ Authentication-based rules prepared (commented out)

---

## Before Production Deployment

### 1. Authentication Implementation
- [ ] Implement Firebase Authentication in the app
  - [ ] Add login/signup UI components
  - [ ] Add authentication state management
  - [ ] Protect routes that require authentication
  - [ ] Add logout functionality
  - [ ] Test authentication flow

### 2. Security Rules Update
- [ ] Switch to authentication-based rules
  - [ ] Uncomment Option 2 in `firestore.rules`
  - [ ] Comment out Option 1 (temporary open access)
  - [ ] Test rules with authenticated users
  - [ ] Deploy updated rules: `firebase deploy --only firestore:rules`

### 3. Environment Configuration
- [ ] Set up production Firebase project (or use current one)
- [ ] Configure environment variables for production
- [ ] Ensure `.env.local` is in `.gitignore` (should already be)
- [ ] Set up production environment variables in hosting platform

### 4. Testing
- [ ] Test all CRUD operations with authentication
- [ ] Test that unauthenticated users cannot access data
- [ ] Test authentication flows (login, logout, session persistence)
- [ ] Load testing (if applicable)

### 5. Deployment
- [ ] Build production bundle: `npm run build`
- [ ] Test production build locally
- [ ] Deploy to Firebase Hosting or your chosen platform
- [ ] Verify production deployment works correctly

---

## Development Best Practices

### Current Setup (Development)
- ✅ Open Firestore rules - allows easy development and testing
- ✅ Single Firebase project - fine for solo/small team development
- ✅ Local development server on port 3000

### Recommended for Team Development
- Consider separate Firebase projects for:
  - `performancecoachapp-dev` (development)
  - `performancecoachapp-staging` (staging/testing)
  - `performancecoachapp-prod` (production)

### Security Notes
- **Never commit** `.env.local` or Firebase service account keys
- The current open access rules are **ONLY for development**
- **Must implement authentication** before going to production
- Consider adding rate limiting for production

---

## Quick Commands

### Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Switch Firebase Projects
```bash
firebase use <project-id>
firebase use --add  # Add a new project
```

### Build for Production
```bash
npm run build
```

### Deploy to Firebase Hosting
```bash
firebase deploy --only hosting
```

---

## Timeline Recommendation

1. **Now (Development)**: Keep current setup, focus on building features
2. **1-2 weeks before launch**: Implement authentication
3. **1 week before launch**: Switch to auth-based rules, test thoroughly
4. **Launch**: Deploy with proper security in place

---

## Questions to Consider

- Will this be a single-user app or multi-user?
- Do you need user roles (admin, coach, client)?
- Will clients need to access their own data?
- Do you need email/password auth, or social login (Google, etc.)?



---

*Last Updated: January 10, 2026*
