export default function WorkoutTypeVisualsPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-blue-900 text-white p-5 mb-5">
        <h1 className="text-2xl font-bold">Workout Type Defaults: Dev Visuals</h1>
        <p className="text-sm text-blue-100 mt-1">
          Visual guide for current behavior, target behavior, and implementation priority.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-base font-semibold mb-2">Current State</h2>
          <p className="text-sm text-slate-600 mb-3">
            Workout type is identity only. Template section config is saved, but movement defaults are not auto-applied in the editor.
          </p>
          <div className="space-y-2 text-sm">
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-2">
              <div className="font-semibold">Workout Type</div>
              <div className="text-slate-600">name, color, description</div>
            </div>
            <div className="text-center text-slate-500">↓</div>
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-2">
              <div className="font-semibold">Workout Structure Template</div>
              <div className="text-slate-600">section with workout type + config</div>
            </div>
            <div className="text-center text-slate-500">↓</div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
              <div className="font-semibold text-amber-800">Workout Editor</div>
              <div className="text-amber-700">round name/color auto-set, movements still manual</div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-base font-semibold mb-2">Target State</h2>
          <p className="text-sm text-slate-600 mb-3">
            Each workout type stores default movement slots with category + movement. Template apply auto-fills rounds.
          </p>
          <div className="space-y-2 text-sm">
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-2">
              <div className="font-semibold">Workout Type (enhanced)</div>
              <div className="text-slate-600">+ defaultMovementSelections[]</div>
            </div>
            <div className="text-center text-slate-500">↓</div>
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-2">
              <div className="font-semibold">Workout Structure Template</div>
              <div className="text-slate-600">selects workout types per section</div>
            </div>
            <div className="text-center text-slate-500">↓</div>
            <div className="rounded-lg border border-green-300 bg-green-50 p-2">
              <div className="font-semibold text-green-800">Workout Editor</div>
              <div className="text-green-700">round + preselected movement rows auto-built</div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border bg-white p-4 mb-4 overflow-x-auto">
        <h2 className="text-base font-semibold mb-2">Priority Matrix</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border p-2 text-left">Priority</th>
              <th className="border p-2 text-left">Work Item</th>
              <th className="border p-2 text-left">Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2"><span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5">P1</span></td>
              <td className="border p-2">Add workout type defaults to data model/services/store</td>
              <td className="border p-2">Foundation for everything else</td>
            </tr>
            <tr>
              <td className="border p-2"><span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5">P1</span></td>
              <td className="border p-2">Add Configure UI for category + movement slots</td>
              <td className="border p-2">Coach can define reusable patterns</td>
            </tr>
            <tr>
              <td className="border p-2"><span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">P2</span></td>
              <td className="border p-2">Auto-fill rounds when structure template is applied</td>
              <td className="border p-2">Primary click reduction benefit</td>
            </tr>
            <tr>
              <td className="border p-2"><span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">P2</span></td>
              <td className="border p-2">Prompt on overwrite when round already edited</td>
              <td className="border p-2">Matches your ask: ask each time</td>
            </tr>
            <tr>
              <td className="border p-2"><span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5">P3</span></td>
              <td className="border p-2">Deletion safeguards and clean fallback handling</td>
              <td className="border p-2">Avoid stale references and confusion</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-base font-semibold mb-2">Wireframe: Add/Edit Workout Type</h2>
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-3 py-2 text-sm font-semibold text-blue-900">
            Configure → Workout Types → Add Workout Type
          </div>
          <div className="p-3 space-y-3 text-sm">
            <div className="rounded border p-2 bg-slate-50">
              <div className="font-semibold mb-1">Identity</div>
              <div>Name: PP/MB/BALLISTICS</div>
              <div>Color: #3b82f6</div>
            </div>

            <div className="rounded border p-2 bg-slate-50">
              <div className="font-semibold mb-1">Default Movement Slots (custom count)</div>
              <div className="space-y-1">
                <div>Slot 1: Category Hinge → Movement KB Swing</div>
                <div>Slot 2: Category Squat → Movement Goblet Squat</div>
                <div>Slot 3: Category Push/Pull → Movement Push Press</div>
              </div>
            </div>

            <div className="rounded border p-2 bg-slate-50">
              <div className="font-semibold mb-1">Apply Behavior</div>
              <div>When template is applied: auto-fill all rounds</div>
              <div>If round already has edits: ask before overwrite</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
