import { auth } from "src/lib/auth";
import type { APIRoute } from "astro";
 
export const ALL: APIRoute = async (ctx) => {
	return auth.handler(ctx.request);
};