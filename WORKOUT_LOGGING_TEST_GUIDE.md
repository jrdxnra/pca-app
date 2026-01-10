# Workout Logging Feature - Testing Guide

This guide will walk you through testing the complete workout logging functionality, from creating a workout to logging actual performance data.

## Prerequisites

1. **Firebase Setup**
   - Ensure Firebase is configured and connected
   - Firestore database is accessible
   - Authentication is working

2. **User Roles**
   - You need access as both a **coach** (to create workouts) and a **client** (to log workouts)
   - Or use two different accounts/browsers

3. **Application Running**
   - Start the development server: `npm run dev`
   - Application should be accessible at `http://localhost:3000` (or your configured port)

---

## Step 1: Create a Client Workout

### As a Coach:

1. **Navigate to Programs Page**
   - Go to `/programs` or click "Programs" in navigation
   - Select a client from the list

2. **Create or Select a Program Period**
   - If no program exists, create one
   - Ensure you have an active period

3. **Create a Workout**
   - Option A: Use the workout builder
     - Navigate to `/workouts/builder?client={clientId}&date={YYYY-MM-DD}`
     - Or click "Create Workout" from the calendar view
   - Option B: Link to Google Calendar event
     - If Google Calendar is connected, create an event
     - Click the event and select "Create Workout"

4. **Add Exercises to the Workout**
   - Add at least 2-3 different movements/exercises
   - For each exercise, set:
     - **Weight** (if applicable): e.g., "135 lbs"
     - **Reps**: e.g., "10"
     - **RPE** (if applicable): e.g., "7"
     - **Sets**: Set to 2-3 sets per exercise
   - Add some **coach notes** if desired
   - **Save the workout**

5. **Verify Workout is Created**
   - The workout should appear in the calendar view
   - Note the workout ID (you can see it in the URL when viewing)

---

## Step 2: Access Workout as Client

### As a Client (or switch to client view):

1. **Navigate to Workout View**
   - Option A: Via Google Calendar link
     - If workout is linked to a calendar event, open the event in Google Calendar
     - Click the "View Your Workout" link in the event description
   - Option B: Direct URL
     - Navigate to: `/workouts/view?workoutId={workoutId}&client={clientId}&date={YYYY-MM-DD}`
     - Replace placeholders with actual values

2. **Verify Workout Displays Correctly**
   - ✅ Workout title is shown
   - ✅ Date and time (if set) are displayed
   - ✅ Coach notes (if any) are visible
   - ✅ Warmup section (if any) is shown
   - ✅ All exercises are listed with prescribed values
   - ✅ For each exercise, you see:
     - Movement name with category color indicator
     - **Prescribed** section showing target weight, reps, RPE, tempo
     - **Your Actual Performance** section with input fields

---

## Step 3: Log Actual Performance Data

### Fill in Actual Values:

1. **For Each Exercise, Log Actual Sets**
   - Find an exercise (e.g., "Back Squat")
   - In the "Your Actual Performance" section:
     - **Set 1:**
       - Weight: Enter actual weight lifted (e.g., "140")
       - Reps: Enter actual reps completed (e.g., "10")
       - RPE: Enter perceived exertion (e.g., "7.5")
       - Notes: Optional notes (e.g., "Felt strong")
     - **Set 2:**
       - Weight: "145"
       - Reps: "9"
       - RPE: "8"
       - Notes: "Last rep was tough"
     - **Set 3:** (if applicable)
       - Continue logging all sets

2. **Log Session Summary**
   - Scroll to the "Session Summary" section
   - **Session RPE**: Enter overall session RPE (e.g., "7" or "7-8")
   - **Your Notes**: Add any observations (e.g., "Great session, felt energized")

3. **Save the Workout Log**
   - Click the **"Save Workout Log"** button
   - Wait for success message: "Workout logged successfully!"
   - The page should remain on the same view

---

## Step 4: Verify Data Persistence

### Check that Data is Saved:

1. **Reload the Page**
   - Refresh the browser or navigate away and back
   - Go to: `/workouts/view?workoutId={workoutId}&client={clientId}&date={YYYY-MM-DD}`

2. **Verify Previously Entered Data**
   - ✅ All actual values you entered should be pre-filled
   - ✅ Session RPE should be displayed
   - ✅ Your notes should be visible
   - ✅ All sets with logged data should show their values

3. **Check Firestore Database** (Optional)
   - Open Firebase Console
   - Navigate to Firestore Database
   - Look for collection: `workoutLogs`
   - Find document with `scheduledWorkoutId` matching your workout ID
   - Verify the document contains:
     - `clientId`: Your client ID
     - `completedDate`: Timestamp of workout date
     - `exercises`: Array with your logged exercises
     - `sessionRPE`: Number value
     - `athleteNotes`: Your notes string
     - `createdAt`: Timestamp

---

## Step 5: Test Edge Cases

### Test Various Scenarios:

1. **Partial Data Entry**
   - Log only weight and reps (no RPE)
   - Log only RPE (no weight/reps)
   - Log only notes for some sets
   - **Expected**: All entered data should save correctly

2. **Empty Sets**
   - Leave some sets completely empty
   - **Expected**: Empty sets should not be saved (filtered out)

3. **Multiple Exercises**
   - Log data for all exercises in the workout
   - **Expected**: All exercises should save independently

4. **Update Existing Log**
   - After saving, change some values
   - Save again
   - **Expected**: Values should update (not create duplicate)

5. **Session RPE Variations**
   - Test single number: "7"
   - Test range: "7-8"
   - Test decimal: "7.5"
   - **Expected**: Should parse correctly (ranges use first number)

6. **Workout with No Log**
   - View a workout that hasn't been logged yet
   - **Expected**: Form should be empty, no errors

---

## Step 6: Test via Google Calendar Integration

### If Google Calendar is Connected:

1. **Link Workout to Calendar Event**
   - Create a workout linked to a Google Calendar event
   - The event description should contain workout links

2. **Access via Calendar Link**
   - Open Google Calendar
   - Click on the event
   - Click the "View Your Workout" link in description
   - **Expected**: Should navigate to workout view page

3. **Log Workout via Calendar Link**
   - Log actual values
   - Save
   - **Expected**: Should work the same as direct access

---

## Step 7: Verify Data Structure

### Check WorkoutLog Document Structure:

The saved document should match this structure:

```typescript
{
  id: "auto-generated-id",
  scheduledWorkoutId: "workout-id",
  clientId: "client-id",
  completedDate: Timestamp,
  exercises: [
    {
      movementId: "movement-id",
      prescribedSets: 3,
      prescribedReps: "10",
      prescribedRPE: 7,
      prescribedWeight: 135,
      actualSets: [
        { weight: 140, reps: 10, actualRPE: 7.5 },
        { weight: 145, reps: 9, actualRPE: 8 }
      ],
      estimatedOneRepMax: 0,
      notes: "Set 1: Felt strong; Set 2: Last rep was tough"
    }
  ],
  sessionRPE: 7,
  athleteNotes: "Great session, felt energized",
  createdAt: Timestamp
}
```

---

## Troubleshooting

### Common Issues:

1. **"Workout not found"**
   - Check that `workoutId` in URL is correct
   - Verify workout exists in Firestore `clientWorkouts` collection

2. **"Failed to save workout log"**
   - Check browser console for errors
   - Verify Firestore permissions allow writes
   - Check that `clientId` is provided in URL

3. **Data not persisting**
   - Check Firestore rules allow writes to `workoutLogs` collection
   - Verify network tab for failed requests
   - Check browser console for errors

4. **Form not loading existing data**
   - Check that WorkoutLog exists in Firestore
   - Verify `scheduledWorkoutId` matches workout ID
   - Check browser console for loading errors

5. **Missing exercises in log**
   - Only exercises with at least one set of actual data are saved
   - Empty sets are filtered out
   - This is expected behavior

---

## Success Criteria

✅ **All tests pass if:**
- Workout can be created and viewed
- Actual values can be entered for all sets
- Data saves successfully
- Data persists after page reload
- WorkoutLog document is created in Firestore
- Existing logs can be updated
- Google Calendar links work (if integrated)

---

## Next Steps

After testing, you may want to:
- Add 1RM calculation logic
- Create a view to see all workout logs for a client
- Add charts/analytics for logged data
- Export workout logs
- Add coach ability to view client logs

---

## Notes

- **WorkoutLog vs ClientWorkout**: 
  - `ClientWorkout` = Prescribed workout (what coach assigns)
  - `WorkoutLog` = Actual performance (what client logs)
  
- **Same Movement in Multiple Rounds**: 
  - If the same movement appears in multiple rounds, they share the same log data
  - This is a known limitation

- **Estimated 1RM**: 
  - Currently set to 0
  - Can be calculated later using formulas like Epley or Brzycki

