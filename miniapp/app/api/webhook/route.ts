import { NextRequest, NextResponse } from 'next/server';

// Farcaster Mini App webhook — receives lifecycle events
// Events: miniapp_added, miniapp_removed, notifications_enabled, notifications_disabled
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate basic shape
    if (!body || typeof body.event !== 'string') {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    // Log the event (expand with real handling later)
    console.log(`[Webhook] ${body.event}`, {
      fid: body.fid,
      timestamp: new Date().toISOString(),
    });

    switch (body.event) {
      case 'miniapp_added':
        // User added Cogent to their app list
        break;
      case 'miniapp_removed':
        // User removed Cogent
        break;
      case 'notifications_enabled':
        // User enabled notifications — store their notification token
        break;
      case 'notifications_disabled':
        // User disabled notifications
        break;
      default:
        console.log(`[Webhook] Unknown event: ${body.event}`);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
