import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  if (!sql) {
    return NextResponse.json({
      status: 'disconnected',
      message: 'DATABASE_URL is not set'
    }, { status: 503 });
  }

  try {
    const result = await sql`SELECT NOW() as current_time, current_database() as database_name, version() as pg_version;`;
    return NextResponse.json({
      status: 'connected',
      provider: 'Neon Lakebase Postgres',
      branch: process.env.NEON_BRANCH || 'production',
      branchId: process.env.NEON_BRANCH_ID || null,
      serverTime: result[0]?.current_time,
      database: result[0]?.database_name
    });
  } catch (error: any) {
    console.error('Neon connection error:', error.message);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to connect to Neon database'
    }, { status: 500 });
  }
}
