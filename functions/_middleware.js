const CLIENT_HOST = 'client.chiranjitkar.com';
const BOOK_HOST = 'book.chiranjitkar.com';
const FOUNDATION_HOST = 'foundation.chiranjitkar.com';
const MAIN_HOST = 'chiranjitkar.com';
const WWW_MAIN_HOST = 'www.chiranjitkar.com';

function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function serveAsset(context, assetPath) {
  if (context.env && context.env.ASSETS && typeof context.env.ASSETS.fetch === 'function') {
    const assetUrl = new URL(context.request.url);
    assetUrl.pathname = assetPath;
    let res = await context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
    if ((res.status === 308 || res.status === 301) && res.headers.get('Location')) {
      const loc = res.headers.get('Location');
      const nextUrl = new URL(loc, assetUrl);
      res = await context.env.ASSETS.fetch(new Request(nextUrl.toString(), context.request));
    }
    return res;
  }
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = assetPath;
  return context.next(new Request(assetUrl.toString(), context.request));
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  // 1. ISOLATION: Studio is internal-only.
  // Never expose /studio, /studio.html, /studio.js, or /api/staff on client, booking, or foundation subdomains.
  if (host === CLIENT_HOST || host === BOOK_HOST || host === FOUNDATION_HOST) {
    if (
      path === '/studio' ||
      path === '/studio.html' ||
      path.startsWith('/studio/') ||
      path === '/studio.js' ||
      path === '/api/staff' ||
      path.startsWith('/api/staff/')
    ) {
      return notFound();
    }
  }

  // 2. MAIN WEBSITE ROUTING (chiranjitkar.com)
  if (host === MAIN_HOST || host === WWW_MAIN_HOST) {
    if (path === '/foundation' || path === '/foundation.html') {
      return serveAsset(context, '/foundation.html');
    }
    if (path === '/collaborate' || path === '/collaborate.html') {
      const target = new URL('https://' + BOOK_HOST + '/collaborate');
      target.search = url.search;
      return Response.redirect(target.toString(), 302);
    }
    if (path === '/session' || path === '/session.html' || path === '/portal') {
      const target = new URL('https://' + CLIENT_HOST + '/');
      target.search = url.search;
      target.hash = url.hash;
      return Response.redirect(target.toString(), 302);
    }
    if (path === '/book' || path === '/book.html' || path === '/booking') {
      const target = new URL('https://' + BOOK_HOST + '/');
      target.search = url.search;
      target.hash = url.hash;
      return Response.redirect(target.toString(), 302);
    }
    if (path === '/pay' || path === '/pay.html') {
      const target = new URL('https://' + CLIENT_HOST + '/pay.html');
      target.search = url.search;
      target.hash = url.hash;
      return Response.redirect(target.toString(), 302);
    }
  }

  // 3. CLIENT PORTAL SUBDOMAIN ROUTING (client.chiranjitkar.com)
  if (host === CLIENT_HOST) {
    if (path === '/pay' || path === '/pay.html') {
      return serveAsset(context, '/pay.html');
    }
    // Cross-link redirects to booking
    if (path === '/book' || path === '/book.html' || path === '/booking' || path === '/contact' || path === '/contact.html') {
      const target = new URL('https://' + BOOK_HOST + '/');
      target.search = url.search;
      return Response.redirect(target.toString(), 302);
    }

    // Canonical redirect from /session or /session.html to /
    if (path === '/session' || path === '/session.html') {
      const target = new URL('https://' + CLIENT_HOST + '/');
      target.search = url.search;
      return Response.redirect(target.toString(), 302);
    }

    // Serve Client Portal session page at root
    if (path === '/' || path === '/index.html') {
      return serveAsset(context, '/session');
    }
  }

  // 4. BOOKING PORTAL SUBDOMAIN ROUTING (book.chiranjitkar.com)
  if (host === BOOK_HOST) {
    // Cross-link redirects to client portal
    if (path === '/session' || path === '/session.html' || path === '/portal' || path === '/client') {
      const target = new URL('https://' + CLIENT_HOST + '/');
      target.search = url.search;
      return Response.redirect(target.toString(), 302);
    }

    if (path === '/collaborate' || path === '/collaborate.html') {
      return serveAsset(context, '/collaborate.html');
    }

    // Canonical redirect from /book, /book.html, /booking, /contact to /
    if (path === '/book' || path === '/book.html' || path === '/booking' || path === '/contact' || path === '/contact.html') {
      const target = new URL('https://' + BOOK_HOST + '/');
      target.search = url.search;
      return Response.redirect(target.toString(), 302);
    }

    // Serve Booking request form at root
    if (path === '/' || path === '/index.html') {
      return serveAsset(context, '/book');
    }
  }

  // 5. FOUNDATION SUBDOMAIN ROUTING (foundation.chiranjitkar.com)
  if (host === FOUNDATION_HOST) {
    // Cross-link redirects
    if (path === '/session' || path === '/session.html' || path === '/client') {
      const target = new URL('https://' + CLIENT_HOST + '/');
      target.search = url.search;
      return Response.redirect(target.toString(), 302);
    }

    if (path === '/book' || path === '/book.html' || path === '/booking') {
      const target = new URL('https://' + BOOK_HOST + '/');
      target.search = url.search;
      return Response.redirect(target.toString(), 302);
    }

    // Serve Foundation portal at root or /foundation
    if (path === '/' || path === '/index.html' || path === '/foundation' || path === '/foundation.html') {
      return serveAsset(context, '/foundation.html');
    }
  }

  return context.next();
}
