# PC+ App - Complete User Guide

A comprehensive guide for understanding and using the Performance Coach+ App.

---

## 📋 Table of Contents

1. [Schedule Page](#-schedule-page)
2. [Google Calendar Integration](#-google-calendar-integration)
3. [Client Management](#-client-management)
4. [Period Assignment](#-period-assignment)
5. [Workout Builder](#-workout-builder)
6. [Movement Library](#-movement-library)
7. [Configuration](#-configuration)
8. [Troubleshooting](#-troubleshooting)

---

## 📅 Schedule Page

The Schedule page is your main dashboard for viewing and managing client sessions.

### Two-Column Week View

The schedule displays a week at a time with two columns per day:

| Column | Purpose |
|--------|---------|
| **Left (Events)** | Google Calendar events - shows time, client name, location |
| **Right (Workouts)** | Firebase workouts - shows workout details, exercises |

### Current Day Sidebar

On the right side, you'll see today's sessions:
- Shows all events for the current day
- Displays time and location (abbreviated)
- Click any card to view/edit the workout

### Navigation

- **◄ ► Arrows** - Move between weeks
- **Calendar Sync Icon** - Refresh events from Google Calendar (in header)
- **Client Dropdown** - Filter view to specific client or "All Clients"

### Event Cards

Each event card shows:
- Client name (with 👤 icon if linked)
- Time and location (e.g., "10:00 AM @ EXOS")
- Color based on workout category

### Quick Actions

- **Click an event** - Opens workout builder for that session
- **Assign Period button** - Add a new training period to selected client

---

## 📅 Google Calendar Integration

### Overview

PC+ integrates with Google Calendar to display and manage your coaching sessions. When connected, the app reads events from your Google Calendar and displays them on the Schedule page.

### How Syncing Works

**This is a PULL model, not real-time sync.** The app fetches data from Google Calendar when triggered - it doesn't receive automatic push notifications when you change things in Google Calendar directly.

```
┌─────────────────┐     API Call      ┌──────────────────┐
│  Your PC+ App   │ ◄───────────────► │  Google Calendar │
│  (Schedule Page)│                   │  (Your Account)  │
└─────────────────┘                   └──────────────────┘
```

### When Events Are Fetched

| Trigger | What Happens |
|---------|--------------|
| **Page Load** | Fetches events for the visible week |
| **Week Navigation** | When you click ◄ or ► arrows, fetches that week's events |
| **Window Focus** | When you tab back to the app, refreshes events |
| **Sync Button** | Manual refresh using the calendar sync icon in the header |
| **After Creating Event** | Re-fetches to show the new event |
| **After Deleting Event** | Re-fetches to update the view |

### Connecting Google Calendar

1. Go to **Configure** → **App Config.** tab
2. Click **Connect Google Calendar**
3. Sign in with your Google account
4. Grant calendar permissions
5. Return to the app - you should see "Connected" status

### Creating Events from PC+

When you assign a period or create a quick workout:

1. App calls Google Calendar API to create the event
2. Google Calendar adds the event with special metadata
3. App re-fetches events to update the display
4. Event appears in your schedule

**Metadata stored in events:**
- `pcaClientId` - Which client this is for
- `pcaCategory` - Workout category (Personal Training, etc.)
- `pcaWorkoutId` - Linked Firebase workout ID

### ⚠️ Editing in Google Calendar Directly

**Important:** If you edit an event directly in Google Calendar (web/mobile app), PC+ won't know about it immediately.

The change will appear when you:
- Click the sync button in the header
- Navigate to a different week and back
- Refresh the page
- Tab away and back to the app

### Location Management

Google Calendar events often have long location names. Location Management lets you:

1. **Create abbreviations** - Display "EXOS" instead of "EXOS Performance Training Center, 123 Main St..."
2. **Mark as N/A** - Hide irrelevant locations from the schedule display

**How to Use:**
1. Go to **Configure** → **App Config.** tab
2. Scroll to **Location Management**
3. You'll see all locations from your coaching events
4. Click **Add** to create an abbreviation
5. Click **N/A** to hide a location from display

---

## 👥 Client Management

### Viewing Clients

Go to the **Clients** page to see all your clients in a card grid view.

Each client card shows:
- Name and email
- Phone number
- Goals and notes
- Birthday (if set)
- Personal records count

### Adding a New Client

1. Go to **Clients** page
2. Click **Add Client** button (top right)
3. Fill in the form:
   - **Name** (required)
   - **Email**
   - **Phone**
   - **Birthday** (for birthday reminders)
   - **Goals**
   - **Notes**
4. Click **Save**

### Editing a Client

1. Find the client card
2. Click **Edit** button
3. Update any fields
4. Click **Save**

### Deleting a Client

1. Click the **X** icon on the client card
2. Confirm deletion
3. Client moves to "deleted" state (can be restored)

### Restoring a Deleted Client

1. Check **Show deleted** checkbox
2. Find the deleted client (shown with dashed border)
3. Click **Restore**

### Permanent Deletion

1. Show deleted clients
2. Click **Delete Forever**
3. ⚠️ This cannot be undone!

---

## 📊 Period Assignment

Periods are training phases (e.g., Hypertrophy, Strength) that you assign to clients.

### What is a Period?

A period defines:
- **Name** - Training phase name (e.g., "Strength Phase 1")
- **Color** - Visual identifier on the calendar
- **Date Range** - Start and end dates
- **Weekly Schedule** - Which days have workouts

### Assigning a Period to a Client

**From Schedule Page:**
1. Select a client from the dropdown
2. Click **Assign Period** button
3. Choose a period configuration
4. Set start and end dates
5. Choose a week template (optional)
6. Configure times for each training day
7. Click **Assign**

**From Clients Page:**
1. Click the layers icon (⊞) on a client card
2. Follow same steps as above

### Week Templates

Week templates define which days of the week have workouts:

| Template Example | Days |
|------------------|------|
| 3-Day Split | Mon, Wed, Fri |
| 4-Day Upper/Lower | Mon, Tue, Thu, Fri |
| 5-Day Program | Mon-Fri |

### What Happens When You Assign

1. Period is created in Firebase
2. Calendar events are created in Google Calendar
3. Workouts are generated for each scheduled day
4. Events appear on the schedule

### Managing Existing Periods

- **View Periods** - Click the list icon next to Assign Period
- **Delete Period** - Removes period, calendar events, and workouts
- **Clear All** - Removes all periods for a client

---

## 🏋️ Workout Builder

### Accessing the Workout Builder

1. Click on any event card in the schedule
2. Or go to **Workouts** → **Builder** directly
3. Select a client and date

### Workout Structure

A workout consists of:
- **Rounds** - Groups of exercises (e.g., "Warm-up", "Main Work", "Finisher")
- **Exercises** - Individual movements within rounds
- **Sets/Reps/Weight** - Prescription for each exercise
- **RPE** - Rate of Perceived Exertion (1-10)

### Adding Exercises

1. Click **+ Add Exercise** within a round
2. Search for a movement or browse categories
3. Click to add it
4. Set reps, sets, weight, RPE, tempo, rest

### Exercise Details

| Field | Description |
|-------|-------------|
| **Reps** | Number of repetitions (e.g., "10" or "8-12") |
| **Sets** | Number of sets |
| **Weight** | Load in lbs/kg or bodyweight |
| **RPE** | Difficulty rating 1-10 |
| **Tempo** | Eccentric-Pause-Concentric-Pause (e.g., "3-1-2-0") |
| **Rest** | Rest period between sets |
| **Notes** | Special instructions |

### Saving Workouts

- Workouts auto-save as you edit
- Changes sync to Firebase immediately
- Linked calendar events update automatically

### Quick Workouts

For unscheduled sessions:
1. Click **Quick Workout** button
2. Select client and date
3. Choose workout category
4. Build the workout as normal

---

## 💪 Movement Library

### Accessing Movements

Go to the **Movements** page to manage your exercise library.

### Movement Categories

Movements are organized by category:
- Squat, Hinge, Lunge, Push, Pull
- Core, Cardio, Mobility
- And custom categories you create

### Adding a New Movement

1. Click **+ Add Movement**
2. Fill in:
   - **Name** (required)
   - **Category** (required)
   - **Equipment needed**
   - **Instructions**
   - **Video URL** (optional)
3. Click **Save**

### Editing Movements

1. Find the movement in the list
2. Click the edit icon
3. Update fields
4. Click **Save**

### Adding Categories

1. Click **+ Add Category** in the category sidebar
2. Enter category name
3. Choose a color
4. Click **Save**

### Movement Configuration

Toggle **Show Configuration** to see:
- Movement usage statistics
- Which workouts use this movement
- Personal records for each client

---

## ⚙️ Configuration

### Accessing Configuration

Go to **Configure** from the navigation menu.

### Workout Config Tab

#### Periods
Training phase configurations:
- **Name** - Display name (e.g., "Hypertrophy")
- **Color** - Calendar color
- **Focus** - Training focus description

**To add:** Click **+ Add Period**, fill form, save.

#### Week Templates
Weekly workout patterns:
- **Name** - Template name
- **Days** - Which days have workouts
- **Categories** - What type of workout each day

**To add:** Click **+ Add Week Template**, configure days, save.

#### Workout Categories
Session types with colors:
- Personal Training
- Group Class
- Assessment
- Recovery
- Custom categories

**To add:** Click **+ Add Category**, set name and color, save.

#### Workout Types
Classification system for workouts:
- Strength
- Hypertrophy
- Power
- Endurance
- Custom types

#### Structure Templates
Reusable workout formats:
- Pre-built round structures
- Common exercise groupings
- Template warm-ups and cool-downs

### App Config Tab

#### Google Calendar Integration
- **Connect/Disconnect** - Link your Google account
- **Calendar Selection** - Choose which calendar to sync
- **Test Events** - Create test events for debugging

#### Coaching Keywords
Words that identify coaching sessions in your calendar:
- Default: "training", "session", "workout", "coaching"
- Add custom keywords as needed

#### Location Management
- View all locations from events
- Create abbreviations for long location names
- Mark irrelevant locations as N/A

---

## 🔧 Troubleshooting

### Events Not Showing

1. Click the calendar sync button in the header (it now forces a refresh and auto-checks your connection)
2. Check that Google Calendar is connected (Configure → App Config)
3. Verify the correct calendar is selected
4. Make sure events are within the visible date range
5. Check if events have coaching keywords in the title

### Calendar Sync Not Working After Computer Restart

The sync button now automatically re-checks your Google Calendar connection status before syncing. If it still doesn't work:
1. Go to **Configure** → **App Config**
2. Disconnect and reconnect Google Calendar
3. Return to the schedule and sync again

### Calendar Disconnected

1. Go to **Configure** → **App Config**
2. Click **Connect Google Calendar**
3. Complete the OAuth sign-in
4. Return to the schedule page

### "Async Client Component" Error

This is an intermittent Next.js 16/Turbopack issue, not a bug in the app code:
1. Click the "Try Again" button on the error page
2. The page should load properly on retry
3. See `TROUBLESHOOTING.md` for more details

### Location Not Displaying

1. Go to **Configure** → **App Config** → **Location Management**
2. Check if the location is marked as N/A
3. Click **Show** to restore it

### Workout Not Saving

1. Check your internet connection
2. Refresh the page
3. Try saving again
4. Check browser console for errors

### Client Not Appearing

1. Check if **Show deleted** is unchecked
2. Try searching for the client
3. Refresh the clients page

### Periods Not Deleting Properly

1. Use **Clear All** to remove all periods for a client
2. This also removes associated calendar events and workouts
3. Refresh the page after deletion

---

## 📱 Tips & Shortcuts

| Action | How |
|--------|-----|
| **Sync Calendar** | Click calendar icon in header |
| **Navigate Weeks** | Use ◄ ► arrows |
| **Quick View Workout** | Click any event card |
| **Filter by Client** | Use client dropdown on Schedule |
| **Search Clients** | Use search box on Clients page |
| **Search Movements** | Use search box on Movements page |

---

## 🔐 Important Notes

### Data Storage

- **Firebase** - Stores all app data (clients, workouts, settings)
- **Google Calendar** - Stores calendar events
- **LocalStorage** - Stores temporary preferences

### Security

- Google Calendar uses OAuth 2.0 authentication
- Firebase rules control data access
- No passwords stored in the app

### Backups

- Firebase automatically backs up data
- Calendar events exist in your Google account
- Consider periodic exports for critical data

---

*Last Updated: January 10, 2026*
