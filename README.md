# Performance Coach + App (PC+)

A professional performance coaching platform designed for PC3s and PC4s, featuring periodization, RPE tracking, and comprehensive client management.

## Features

- **Client Management**: Complete CRUD operations with soft delete functionality
- **Movement Catalog**: Searchable exercise database with categories and variations
- **Workout Builder**: Create structured workouts with custom rounds and detailed exercise parameters
- **Training Programs**: Calendar-based program management with periodization (Mesocycle, Macrocycle, Microcycle)
- **RPE System**: Rate of Perceived Exertion tracking with e1RM calculations
- **Real-time Updates**: Live synchronization with Firebase/Firestore
- **Educational Design**: Teaches proper periodization principles to coaches

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **State Management**: Zustand
- **Backend**: Firebase/Firestore
- **Forms**: React Hook Form + Zod validation
- **Date Handling**: date-fns

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Firebase:**
   - Create a Firebase project
   - Enable Firestore database
   - Copy your Firebase config to `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)** to view the app

## Project Structure

```
src/
├── app/                    # Next.js app router pages
├── components/            # Reusable UI components
├── lib/
│   ├── firebase/         # Firebase configuration and services
│   ├── stores/           # Zustand state management
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions (RPE calculations, etc.)
└── ...
```

## Key Concepts

### Periodization Layers
- **Mesocycle (Month View)**: 4-6 week training blocks with specific focus periods
- **Macrocycle (Week View)**: Weekly programming structure and workout distribution  
- **Microcycle (Day View)**: Individual workout sessions with detailed parameters

### RPE System
- Rate of Perceived Exertion scale (1-10)
- Automatic e1RM calculations using multiple formulas (Brzycki, Epley, etc.)
- Progressive overload tracking and recommendations

## Deployment

### Testing Environment: Vercel
- **Purpose**: Quick testing and development validation
- **Deployment**: Automatic via GitHub pushes
- **Setup**: See [VERCEL_SETUP.md](./VERCEL_SETUP.md)

### Production Environment: Firebase + Cloud Run
- **Purpose**: Live production environment for end users
- **Deployment**: Manual via `npm run deploy:firebase`
- **Setup**: See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) and [QUICK_START_FIREBASE.md](./QUICK_START_FIREBASE.md)

**Workflow**: Test on Vercel → Validate → Deploy to Firebase when ready

See [PROJECT_PREFERENCES.md](./PROJECT_PREFERENCES.md) for deployment strategy details.

## License

Private project for performance coaching professionals.