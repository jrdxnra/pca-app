import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm md:p-12">
        <div className="mb-8">
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Back to login
          </Link>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900">Terms of Service</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: May 2, 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-7 text-gray-700">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">Use of the Service</h2>
            <p className="mt-2">
              Performance Coach + is intended for coaches and authorized users managing training, scheduling, and related workflow data. By using the service, you agree to use it only for legitimate business or coaching purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Google Account Access</h2>
            <p className="mt-2">
              Google Calendar access is optional and is only requested when a user explicitly chooses to connect Google Calendar. By approving access, you authorize Performance Coach + to read your calendar list and manage calendar events needed for the app&apos;s scheduling features.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">User Responsibility</h2>
            <p className="mt-2">
              You are responsible for maintaining the security of your account, reviewing any calendar actions taken through the app, and ensuring that the data you manage through the service is appropriate for your use case.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Service Availability</h2>
            <p className="mt-2">
              The service may change over time and may be updated, interrupted, or unavailable temporarily for maintenance, infrastructure changes, or third-party provider issues.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
            <p className="mt-2">
              For terms or support questions, contact: <a className="font-medium text-blue-600 hover:text-blue-700" href="mailto:jrdxn.ra@gmail.com">jrdxn.ra@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}