import { type NextRequest } from "next/server";
import { updateSession } from "./utils/supabase/middleware";

export const middleware = async (request: NextRequest) => {
  return updateSession(request);
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|webmanifest)$).*)",
  ],
};
