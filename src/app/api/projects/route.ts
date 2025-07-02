// src/app/api/projects/route.ts

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  // Fetch all projects, ordered by creation date desc
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const {
    name,
    description,
    owner_id,
    start_date,
    due_date,
    visibility,
    tags,
  } = await request.json();

  // Basic validation
  if (!name || !owner_id) {
    return NextResponse.json(
      { error: '项目名称和负责人必填' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert([
      {
        name,
        description,
        owner_id,
        start_date,
        due_date,
        visibility: visibility || 'private',
        tags: tags || [],
      },
    ])
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
