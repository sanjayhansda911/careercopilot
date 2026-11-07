import { NextRequest, NextResponse } from 'next/server';
import { runDiscoveryAgent } from '@/lib/agents/discovery';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { sources, targetRoleKeywords, userId } = body;

    const result = await runDiscoveryAgent({
      userId,
      sources,
      targetRoleKeywords
    });

    return NextResponse.json({
      status: 'success',
      discovery: result
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Discovery Agent sweep failed.' },
      { status: 500 }
    );
  }
}
