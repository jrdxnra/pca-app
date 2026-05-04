import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm md:p-12">
        <div className="mb-8">
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Back to login
          </Link>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: May 2, 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-7 text-gray-700">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
            <p className="mt-2">
              Performance Coach + helps coaches manage clients, schedules, workouts, and calendar events. This policy explains what data the app accesses, how it is used, and how users can revoke access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Information We Collect</h2>
            <p className="mt-2">
              We collect account information needed to sign users in, app configuration data created by the user, and calendar data only after the user explicitly chooses to connect Google Calendar.
            </p>
            <p className="mt-2">
              Calendar access is limited to reading calendar lists and creating, updating, or deleting events needed for coaching session scheduling inside the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">How Google Calendar Data Is Used</h2>
            <p className="mt-2">
              Google Calendar data is used to let a signed-in coach choose a calendar, view relevant event information, and create or update coaching-related events from within Performance Coach +.
            </p>
            <p className="mt-2">
              The app does not request calendar access during login. Calendar permissions are requested separately when the user chooses to connect Google Calendar from the Configure page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">How Data Is Stored</h2>
            <p className="mt-2">
              Account and application data may be stored in Firebase services used by the app. OAuth tokens used for Google Calendar access are stored only to maintain the user&apos;s calendar connection and can be removed by disconnecting Google Calendar.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">How To Revoke Access</h2>
            <p className="mt-2">
              Users can disconnect Google Calendar from the Configure page inside the app. Users can also revoke Google access directly from their Google Account permissions settings at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
            <p className="mt-2">
              For support, privacy, or data questions, contact: <a className="font-medium text-blue-600 hover:text-blue-700" href="mailto:jrdxn.ra@gmail.com">jrdxn.ra@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}