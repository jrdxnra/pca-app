'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { getActiveMembership } from '@/lib/firebase/services/memberships';
import {
	defaultSkillSandboxRequest,
	skillSandboxApiContract,
	skillSandboxPhaseTypes,
	type SkillSandboxRequest,
	type SkillSandboxResponse,
	skillSandboxTimeHorizons,
	skillSandboxTrainingStyles,
} from '@/lib/skills/sandbox-contract';

type MembershipRole = 'owner' | 'coach' | 'client' | null;
type SkillOutputCard = {
	title: string;
	output: Record<string, unknown>;
};

function createRecentWorkout() {
	return {
		id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		date: '',
		title: '',
		focus: '',
		summary: '',
		readiness: 3,
		notes: '',
	};
}

function createCalendarEvent() {
	return {
		id: `calendar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		label: '',
		type: 'custom' as const,
		impact: 'medium' as const,
		notes: '',
	};
}

function arrayToTextarea(values: string[]): string {
	return values.join('\n');
}

function textareaToArray(value: string): string[] {
	return value
		.split('\n')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function StatusBadge({ status }: { status: 'pass' | 'warn' | 'fail' }) {
	const palette =
		status === 'pass'
			? 'bg-emerald-100 text-emerald-800 border-emerald-200'
			: status === 'warn'
				? 'bg-amber-100 text-amber-800 border-amber-200'
				: 'bg-red-100 text-red-800 border-red-200';

	return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${palette}`}>{status}</span>;
}

function IssueList({ title, items }: { title: string; items: string[] }) {
	if (items.length === 0) {
		return (
			<div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
				<div className="font-semibold text-slate-800">{title}</div>
				<div>None</div>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-slate-200 bg-white p-3">
			<div className="mb-2 text-sm font-semibold text-slate-900">{title}</div>
			<ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
				{items.map((item) => (
					<li key={`${title}-${item}`}>{item}</li>
				))}
			</ul>
		</div>
	);
}

export default function SkillSandboxPage() {
	const { user, idToken } = useAuth();
	const router = useRouter();
	const [request, setRequest] = useState<SkillSandboxRequest>(defaultSkillSandboxRequest);
	const [result, setResult] = useState<SkillSandboxResponse | null>(null);
	const [role, setRole] = useState<MembershipRole>(null);
	const [loadingAccess, setLoadingAccess] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		const checkAccess = async () => {
			if (!user) return;

			try {
				const membership = await getActiveMembership(user.uid);
				const membershipRole: MembershipRole = membership?.role ?? null;
				setRole(membershipRole);
				if (membershipRole !== 'owner' && membershipRole !== 'coach') {
					router.push('/dashboard');
				}
			} catch (accessError) {
				console.error('Failed to load sandbox access:', accessError);
				router.push('/dashboard');
			} finally {
				setLoadingAccess(false);
			}
		};

		void checkAccess();
	}, [router, user]);

	const requestPreview = useMemo(() => JSON.stringify(request, null, 2), [request]);
	const skillOutputCards: SkillOutputCard[] = result
		? [
				{ title: 'SKILL 1: Context Analyzer', output: result.skillOutputs.contextAnalyzer },
				{ title: 'SKILL 2: Session Planner', output: result.skillOutputs.sessionPlanner },
				{ title: 'SKILL 7: Progression Reasoner', output: result.skillOutputs.progressionReasoner },
				{ title: 'SKILL 3: Movement Generator', output: result.skillOutputs.movementGenerator },
				{ title: 'SKILL 4: Quality Validator', output: result.skillOutputs.qualityValidator },
				{ title: 'SKILL 5: Session Sequencer', output: result.skillOutputs.sessionSequencer },
				{ title: 'SKILL 6: Feedback Interpreter', output: result.skillOutputs.feedbackInterpreter },
			]
		: [];

	const runSandbox = async () => {
		if (!idToken) {
			setError('You must be signed in to run the skill sandbox.');
			return;
		}

		setSubmitting(true);
		setError('');
		try {
			const bearerToken = ['Bearer', idToken].join(' ');
			const response = await fetch('/api/admin/skills/sandbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					authorization: bearerToken,
				},
				body: JSON.stringify(request),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Failed to run skill sandbox');
			}

			setResult(data);
		} catch (runError) {
			setError(runError instanceof Error ? runError.message : 'Failed to run skill sandbox');
		} finally {
			setSubmitting(false);
		}
	};

	if (loadingAccess) {
		return <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-600">Loading skill sandbox…</div>;
	}

	if (role !== 'owner' && role !== 'coach') {
		return <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-600">Checking access…</div>;
	}

	return (
		<div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
			<div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="max-w-3xl">
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Internal Admin Sandbox</p>
						<h1 className="mt-2 text-3xl font-semibold">Skill-System Workout Sandbox</h1>
						<p className="mt-3 text-sm text-slate-200">
							Run the current skill chain with structured test inputs, inspect each intermediate skill output, and QA the generated workout before wiring it into production flows.
						</p>
						<div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200">
							{skillSandboxApiContract.references.map((reference) => (
								<span key={reference} className="rounded-full border border-white/20 px-3 py-1">
									{reference}
								</span>
							))}
						</div>
					</div>
					<div className="flex gap-3">
						<Link href="/admin" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
							Back to Admin
						</Link>
						<button
							type="button"
							onClick={() => setRequest(defaultSkillSandboxRequest)}
							className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
						>
							Reset Sample
						</button>
						<button
							type="button"
							onClick={runSandbox}
							disabled={submitting}
							className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{submitting ? 'Running…' : 'Run Skill Chain'}
						</button>
					</div>
				</div>
			</div>

			{error && (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			)}

			<div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
				<div className="space-y-6">
					<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-4">
							<h2 className="text-lg font-semibold text-slate-900">Structured Sandbox Inputs</h2>
							<p className="text-sm text-slate-600">Edit the workout-generation variables below, then run the sandbox to inspect every skill output.</p>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-4 rounded-xl border border-slate-200 p-4">
								<h3 className="font-semibold text-slate-900">Client Profile</h3>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Client name</span>
									<input value={request.clientProfile.name} onChange={(event) => setRequest((current) => ({ ...current, clientProfile: { ...current.clientProfile, name: event.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Client ID</span>
									<input value={request.clientProfile.clientId} onChange={(event) => setRequest((current) => ({ ...current, clientProfile: { ...current.clientProfile, clientId: event.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Training age</span>
									<input value={request.clientProfile.trainingAge} onChange={(event) => setRequest((current) => ({ ...current, clientProfile: { ...current.clientProfile, trainingAge: event.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Primary goal</span>
									<input value={request.clientProfile.primaryGoal} onChange={(event) => setRequest((current) => ({ ...current, clientProfile: { ...current.clientProfile, primaryGoal: event.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Secondary goals (one per line)</span>
									<textarea value={arrayToTextarea(request.clientProfile.secondaryGoals)} onChange={(event) => setRequest((current) => ({ ...current, clientProfile: { ...current.clientProfile, secondaryGoals: textareaToArray(event.target.value) } }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Restrictions (one per line)</span>
									<textarea value={arrayToTextarea(request.clientProfile.restrictions)} onChange={(event) => setRequest((current) => ({ ...current, clientProfile: { ...current.clientProfile, restrictions: textareaToArray(event.target.value) } }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Preferences (one per line)</span>
									<textarea value={arrayToTextarea(request.clientProfile.preferences)} onChange={(event) => setRequest((current) => ({ ...current, clientProfile: { ...current.clientProfile, preferences: textareaToArray(event.target.value) } }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
							</div>

							<div className="space-y-4 rounded-xl border border-slate-200 p-4">
								<h3 className="font-semibold text-slate-900">Program + Session Context</h3>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Training style</span>
									<select value={request.trainingStyle} onChange={(event) => setRequest((current) => ({ ...current, trainingStyle: event.target.value as SkillSandboxRequest['trainingStyle'] }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">
										{skillSandboxTrainingStyles.map((style) => (
											<option key={style} value={style}>
												{style}
											</option>
										))}
									</select>
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Time horizon</span>
									<select value={request.timeHorizon} onChange={(event) => setRequest((current) => ({ ...current, timeHorizon: event.target.value as SkillSandboxRequest['timeHorizon'] }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">
										{skillSandboxTimeHorizons.map((horizon) => (
											<option key={horizon} value={horizon}>
												{horizon}
											</option>
										))}
									</select>
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Phase</span>
									<select value={request.blockContext.phase} onChange={(event) => setRequest((current) => ({ ...current, blockContext: { ...current.blockContext, phase: event.target.value as SkillSandboxRequest['blockContext']['phase'] } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">
										{skillSandboxPhaseTypes.map((phase) => (
											<option key={phase} value={phase}>
												{phase}
											</option>
										))}
									</select>
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Block name</span>
									<input value={request.blockContext.blockName} onChange={(event) => setRequest((current) => ({ ...current, blockContext: { ...current.blockContext, blockName: event.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<div className="grid grid-cols-2 gap-3">
									<label className="block text-sm">
										<span className="mb-1 block text-slate-700">Week number</span>
										<input type="number" min={1} value={request.blockContext.weekNumber} onChange={(event) => setRequest((current) => ({ ...current, blockContext: { ...current.blockContext, weekNumber: Number(event.target.value) || 1 } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
									</label>
									<label className="block text-sm">
										<span className="mb-1 block text-slate-700">Weeks remaining</span>
										<input type="number" min={0} value={request.blockContext.weeksRemaining} onChange={(event) => setRequest((current) => ({ ...current, blockContext: { ...current.blockContext, weeksRemaining: Number(event.target.value) || 0 } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
									</label>
								</div>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Block notes</span>
									<textarea value={request.blockContext.notes} onChange={(event) => setRequest((current) => ({ ...current, blockContext: { ...current.blockContext, notes: event.target.value } }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Session date</span>
									<input type="date" value={request.sessionContext.sessionDate} onChange={(event) => setRequest((current) => ({ ...current, sessionContext: { ...current.sessionContext, sessionDate: event.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Template context</span>
									<input value={request.sessionContext.templateName} onChange={(event) => setRequest((current) => ({ ...current, sessionContext: { ...current.sessionContext, templateName: event.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Session type</span>
									<input value={request.sessionContext.sessionType} onChange={(event) => setRequest((current) => ({ ...current, sessionContext: { ...current.sessionContext, sessionType: event.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Duration (minutes)</span>
									<input type="number" min={1} max={240} value={request.sessionContext.durationMinutes} onChange={(event) => setRequest((current) => ({ ...current, sessionContext: { ...current.sessionContext, durationMinutes: Number(event.target.value) || 1 } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Session notes</span>
									<textarea value={request.sessionContext.notes} onChange={(event) => setRequest((current) => ({ ...current, sessionContext: { ...current.sessionContext, notes: event.target.value } }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
							</div>
						</div>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-4 flex items-center justify-between">
							<div>
								<h3 className="text-lg font-semibold text-slate-900">Recent Workout History</h3>
								<p className="text-sm text-slate-600">Keep this structured so the progression and sequencing steps have realistic inputs.</p>
							</div>
							<button type="button" onClick={() => setRequest((current) => ({ ...current, recentWorkoutHistory: [...current.recentWorkoutHistory, createRecentWorkout()] }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
								+ Add workout
							</button>
						</div>
						<div className="space-y-4">
							{request.recentWorkoutHistory.map((workout, index) => (
								<div key={workout.id} className="rounded-xl border border-slate-200 p-4">
									<div className="mb-3 flex items-center justify-between">
										<h4 className="font-semibold text-slate-900">Workout {index + 1}</h4>
										<button type="button" onClick={() => setRequest((current) => ({ ...current, recentWorkoutHistory: current.recentWorkoutHistory.filter((entry) => entry.id !== workout.id) }))} className="text-sm text-red-600">
											Remove
										</button>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<label className="block text-sm">
											<span className="mb-1 block text-slate-700">Date</span>
											<input type="date" value={workout.date} onChange={(event) => setRequest((current) => ({ ...current, recentWorkoutHistory: current.recentWorkoutHistory.map((entry) => entry.id === workout.id ? { ...entry, date: event.target.value } : entry) }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
										</label>
										<label className="block text-sm">
											<span className="mb-1 block text-slate-700">Title</span>
											<input value={workout.title} onChange={(event) => setRequest((current) => ({ ...current, recentWorkoutHistory: current.recentWorkoutHistory.map((entry) => entry.id === workout.id ? { ...entry, title: event.target.value } : entry) }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
										</label>
										<label className="block text-sm">
											<span className="mb-1 block text-slate-700">Focus</span>
											<input value={workout.focus} onChange={(event) => setRequest((current) => ({ ...current, recentWorkoutHistory: current.recentWorkoutHistory.map((entry) => entry.id === workout.id ? { ...entry, focus: event.target.value } : entry) }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
										</label>
										<label className="block text-sm">
											<span className="mb-1 block text-slate-700">Readiness (1-5)</span>
											<input type="number" min={1} max={5} value={workout.readiness ?? ''} onChange={(event) => setRequest((current) => ({ ...current, recentWorkoutHistory: current.recentWorkoutHistory.map((entry) => entry.id === workout.id ? { ...entry, readiness: Number(event.target.value) || 1 } : entry) }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
										</label>
										<label className="block text-sm md:col-span-2">
											<span className="mb-1 block text-slate-700">Summary</span>
											<textarea value={workout.summary} onChange={(event) => setRequest((current) => ({ ...current, recentWorkoutHistory: current.recentWorkoutHistory.map((entry) => entry.id === workout.id ? { ...entry, summary: event.target.value } : entry) }))} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" />
										</label>
										<label className="block text-sm md:col-span-2">
											<span className="mb-1 block text-slate-700">Notes</span>
											<textarea value={workout.notes} onChange={(event) => setRequest((current) => ({ ...current, recentWorkoutHistory: current.recentWorkoutHistory.map((entry) => entry.id === workout.id ? { ...entry, notes: event.target.value } : entry) }))} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" />
										</label>
									</div>
								</div>
							))}
						</div>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-4 rounded-xl border border-slate-200 p-4">
								<h3 className="font-semibold text-slate-900">Feedback / Restrictions / Preferences</h3>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Feedback notes (one per line)</span>
									<textarea value={arrayToTextarea(request.feedbackContext.notes)} onChange={(event) => setRequest((current) => ({ ...current, feedbackContext: { ...current.feedbackContext, notes: textareaToArray(event.target.value) } }))} className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Restrictions (one per line)</span>
									<textarea value={arrayToTextarea(request.feedbackContext.restrictions)} onChange={(event) => setRequest((current) => ({ ...current, feedbackContext: { ...current.feedbackContext, restrictions: textareaToArray(event.target.value) } }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Preferences (one per line)</span>
									<textarea value={arrayToTextarea(request.feedbackContext.preferences)} onChange={(event) => setRequest((current) => ({ ...current, feedbackContext: { ...current.feedbackContext, preferences: textareaToArray(event.target.value) } }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
							</div>

							<div className="space-y-4 rounded-xl border border-slate-200 p-4">
								<div className="flex items-center justify-between">
									<h3 className="font-semibold text-slate-900">Calendar Context</h3>
									<button type="button" onClick={() => setRequest((current) => ({ ...current, calendarContext: { ...current.calendarContext, events: [...current.calendarContext.events, createCalendarEvent()] } }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
										+ Add event
									</button>
								</div>
								<div className="space-y-3">
									{request.calendarContext.events.map((event) => (
										<div key={event.id} className="rounded-lg border border-slate-200 p-3">
											<div className="mb-2 flex justify-between text-sm">
												<span className="font-medium text-slate-800">Calendar event</span>
												<button type="button" onClick={() => setRequest((current) => ({ ...current, calendarContext: { ...current.calendarContext, events: current.calendarContext.events.filter((entry) => entry.id !== event.id) } }))} className="text-red-600">
													Remove
												</button>
											</div>
											<div className="grid gap-3 md:grid-cols-2">
												<label className="block text-sm md:col-span-2">
													<span className="mb-1 block text-slate-700">Label</span>
													<input value={event.label} onChange={(changeEvent) => setRequest((current) => ({ ...current, calendarContext: { ...current.calendarContext, events: current.calendarContext.events.map((entry) => entry.id === event.id ? { ...entry, label: changeEvent.target.value } : entry) } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
												</label>
												<label className="block text-sm">
													<span className="mb-1 block text-slate-700">Type</span>
													<select value={event.type} onChange={(changeEvent) => setRequest((current) => ({ ...current, calendarContext: { ...current.calendarContext, events: current.calendarContext.events.map((entry) => entry.id === event.id ? { ...entry, type: changeEvent.target.value as SkillSandboxRequest['calendarContext']['events'][number]['type'] } : entry) } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">
														<option value="travel">travel</option>
														<option value="holiday">holiday</option>
														<option value="deload">deload</option>
														<option value="competition">competition</option>
														<option value="custom">custom</option>
													</select>
												</label>
												<label className="block text-sm">
													<span className="mb-1 block text-slate-700">Impact</span>
													<select value={event.impact} onChange={(changeEvent) => setRequest((current) => ({ ...current, calendarContext: { ...current.calendarContext, events: current.calendarContext.events.map((entry) => entry.id === event.id ? { ...entry, impact: changeEvent.target.value as SkillSandboxRequest['calendarContext']['events'][number]['impact'] } : entry) } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">
														<option value="low">low</option>
														<option value="medium">medium</option>
														<option value="high">high</option>
													</select>
												</label>
												<label className="block text-sm md:col-span-2">
													<span className="mb-1 block text-slate-700">Notes</span>
													<textarea value={event.notes} onChange={(changeEvent) => setRequest((current) => ({ ...current, calendarContext: { ...current.calendarContext, events: current.calendarContext.events.map((entry) => entry.id === event.id ? { ...entry, notes: changeEvent.target.value } : entry) } }))} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" />
												</label>
											</div>
										</div>
									))}
								</div>
								<label className="block text-sm">
									<span className="mb-1 block text-slate-700">Calendar notes</span>
									<textarea value={request.calendarContext.notes} onChange={(event) => setRequest((current) => ({ ...current, calendarContext: { ...current.calendarContext, notes: event.target.value } }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
								</label>
							</div>
						</div>
					</section>
				</div>

				<div className="space-y-6">
					<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-3 flex items-center justify-between">
							<h2 className="text-lg font-semibold text-slate-900">API Contract Preview</h2>
							<span className="text-xs text-slate-500">/api/admin/skills/sandbox</span>
						</div>
						<p className="mb-3 text-sm text-slate-600">
							The sandbox uses a modular request/response shape so the same contract can be wired into the website later.
						</p>
						<pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{requestPreview}</pre>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-3 flex items-center justify-between">
							<h2 className="text-lg font-semibold text-slate-900">QA Status</h2>
							{result ? <StatusBadge status={result.qaSummary.status} /> : <span className="text-sm text-slate-500">Run the sandbox</span>}
						</div>
						{result ? (
							<div className="space-y-3">
								<IssueList title="Warnings" items={result.qaSummary.warnings} />
								<IssueList title="Safety Issues" items={result.qaSummary.safetyIssues} />
								<IssueList title="Progression Issues" items={result.qaSummary.progressionIssues} />
								<IssueList title="Sequencing Issues" items={result.qaSummary.sequencingIssues} />
							</div>
						) : (
							<p className="text-sm text-slate-600">Warnings, safety issues, progression issues, and sequencing issues will appear here.</p>
						)}
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h2 className="mb-3 text-lg font-semibold text-slate-900">Final Generated Workout</h2>
						{result ? (
							<div className="space-y-4">
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
									<div className="text-sm text-slate-500">{result.finalWorkout.sessionDate}</div>
									<div className="text-xl font-semibold text-slate-900">{result.finalWorkout.title}</div>
									<p className="mt-2 text-sm text-slate-700">{result.finalWorkout.coachSummary}</p>
								</div>
								{result.finalWorkout.blocks.map((block) => (
									<div key={block.name} className="rounded-xl border border-slate-200 p-4">
										<div className="mb-2 flex items-center justify-between">
											<h3 className="font-semibold text-slate-900">{block.name}</h3>
											<span className="text-sm text-slate-500">{block.durationMinutes} min</span>
										</div>
										<div className="space-y-3">
											{block.movements.map((movement) => (
												<div key={`${block.name}-${movement.slot}-${movement.movement}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
													<div className="text-xs font-semibold uppercase tracking-wide text-blue-700">{movement.slot}</div>
													<div className="mt-1 font-medium text-slate-900">{movement.movement}</div>
													<div className="mt-1 text-sm text-slate-700">{movement.prescription}</div>
													<div className="mt-1 text-sm text-slate-500">{movement.intent}</div>
												</div>
											))}
										</div>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-slate-600">The final workout is shown separately from the intermediate skill outputs after each run.</p>
						)}
					</section>
				</div>
			</div>

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Step-by-Step Skill Outputs</h2>
						<p className="text-sm text-slate-600">Inspect the exact sandbox output for each skill in the current chain.</p>
					</div>
					{result && <StatusBadge status={result.qaSummary.status} />}
				</div>
				{result ? (
					<div className="grid gap-4 lg:grid-cols-2">
						{skillOutputCards.map((card) => (
							<div key={card.title} className="rounded-xl border border-slate-200 p-4">
								<h3 className="mb-3 font-semibold text-slate-900">{card.title}</h3>
								<pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(card.output, null, 2)}</pre>
							</div>
						))}
					</div>
				) : (
					<p className="text-sm text-slate-600">Run the sandbox to populate intermediate outputs for all required skills.</p>
				)}
			</section>
		</div>
	);
}
