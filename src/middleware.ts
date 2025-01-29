import { auth } from "src/lib/auth";
import { defineMiddleware } from "astro:middleware";
import { securityHeaders } from "src/lib/security";

const safeRoutes = [
  "/",
  "/become-a-host",
  "/404",
  "/signin",
  "/contact",
  "/events/*",
  "/privacy",
  "/terms",
  "/createprofile",
  "/api/auth/*",
  "/api/event/series/*",
  "/reset-password",
  "/about",
  "/_server-islands/RecentEvents",
  "/_server-islands/EventRegistrationButton",
  "/v1/generate/og/default.png",
];

export const onRequest = defineMiddleware(async (context, next) => {
  const isAuthed = await auth.api.getSession({
    headers: context.request.headers,
  });

  if (isAuthed) {
    context.locals.user = isAuthed.user;
    context.locals.session = isAuthed.session;
  } else {
    context.locals.user = null;
    context.locals.session = null;
  }

  const pathname = new URL(context.request.url).pathname;
  // Remove trailing slash unless it's the root path
  const normalizedPathname = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
  
  // First check if the route exists by getting the response
  const response = await next();
  
  // If the route doesn't exist (404), just return the response
  if (response.status === 404) {
    // Add security headers to the 404 response
    const headers = new Headers(response.headers);
    Object.entries(securityHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }

  // If the route exists, check if it's protected
  const isProtected = !safeRoutes.some((route) => {
    if (route.endsWith('*')) {
      const baseRoute = route.slice(0, -1);
      // Check if the path exactly matches the base route (without the /*) or starts with base route + /
      return normalizedPathname === baseRoute.slice(0, -1) || normalizedPathname.startsWith(baseRoute);
    }
    return normalizedPathname === route;
  });

  if (isProtected && !isAuthed) {
    const redirectUrl = encodeURIComponent(normalizedPathname);
    return new Response(null, {
      status: 302,
      headers: { Location: `/signin?redirect=${redirectUrl}`, ...securityHeaders },
    });
  }
  
  // Add security headers to the response
  // const headers = new Headers(response.headers);
  // Object.entries(securityHeaders).forEach(([key, value]) => {
  //   headers.set(key, value);
  // });

  return new Response(response.body, {
    status: response.status,
    // headers,
  });
});
