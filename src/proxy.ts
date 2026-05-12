import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
    const path = request.nextUrl.pathname;

    const isPublicPath =
        path === '/login' ||
        path.startsWith('/_next') ||
        path === '/manifest.json' ||
        path.startsWith('/icon-') ||      // /icon-192x192.png, /icon-512x512.png
        path === '/icon.svg' ||
        path === '/apple-touch-icon.png' ||
        path === '/favicon.ico';

    const token = request.cookies.get('auth_token')?.value;

    if (!isPublicPath && !token) {
        return NextResponse.redirect(new URL('/login', request.nextUrl));
    }

    if (path === '/login' && token) {
        return NextResponse.redirect(new URL('/', request.nextUrl));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
