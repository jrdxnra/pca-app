import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { MASTER_UID } from '@/lib/firebase/services/memberships';
import {
	defaultSkillSandboxRequest,
	skillSandboxApiContract,
	skillSandboxRequestSchema,
} from '@/lib/skills/sandbox-contract';
import { runSkillSandbox } from '@/lib/skills/sandbox-runner';

async function userHasSandboxAccess(userId: string): Promise<boolean> {
	if (userId === MASTER_UID) {
		return true;
	}

	const db = getAdminDb();
	const membershipSnapshot = await db.collection('memberships').where('userId', '==', userId).limit(5).get();

	return membershipSnapshot.docs.some((doc) => {
		const role = doc.data().role;
		return role === 'owner' || role === 'coach' || role === 'trainer';
	});
}

async function authorize(request: NextRequest): Promise<string | NextResponse> {
	const userId = await getAuthenticatedUser(request);
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const hasAccess = await userHasSandboxAccess(userId);
	if (!hasAccess) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	return userId;
}

export async function GET(request: NextRequest) {
	try {
		const authorized = await authorize(request);
		if (authorized instanceof NextResponse) {
			return authorized;
		}

		const exampleResponse = runSkillSandbox(defaultSkillSandboxRequest);
		return NextResponse.json({
			contract: skillSandboxApiContract,
			exampleResponse,
		});
	} catch (error) {
		console.error('[Skill Sandbox API] Failed to load contract:', error);
		return NextResponse.json({ error: 'Failed to load skill sandbox contract' }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const authorized = await authorize(request);
		if (authorized instanceof NextResponse) {
			return authorized;
		}

		const body = await request.json();
		const parsed = skillSandboxRequestSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{
					error: 'Invalid sandbox request payload',
					issues: parsed.error.flatten(),
				},
				{ status: 400 }
			);
		}

		const result = runSkillSandbox(parsed.data);
		return NextResponse.json(result);
	} catch (error) {
		console.error('[Skill Sandbox API] Failed to run sandbox:', error);
		return NextResponse.json({ error: 'Failed to run skill sandbox' }, { status: 500 });
	}
}
