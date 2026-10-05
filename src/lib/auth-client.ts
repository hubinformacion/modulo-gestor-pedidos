"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin requests: no secrets or deployment URLs in the client bundle.
export const authClient = createAuthClient();
