/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as chat from "../chat.js";
import type * as email from "../email.js";
import type * as entitlements from "../entitlements.js";
import type * as http from "../http.js";
import type * as plans from "../plans.js";
import type * as sandbox from "../sandbox.js";
import type * as sandboxState from "../sandboxState.js";
import type * as sandbox_e2b from "../sandbox/e2b.js";
import type * as sandbox_index from "../sandbox/index.js";
import type * as sandbox_types from "../sandbox/types.js";
import type * as telegram from "../telegram.js";
import type * as telegramApi from "../telegramApi.js";
import type * as threads from "../threads.js";
import type * as tools from "../tools.js";
import type * as workflow from "../workflow.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  auth: typeof auth;
  billing: typeof billing;
  chat: typeof chat;
  email: typeof email;
  entitlements: typeof entitlements;
  http: typeof http;
  plans: typeof plans;
  sandbox: typeof sandbox;
  sandboxState: typeof sandboxState;
  "sandbox/e2b": typeof sandbox_e2b;
  "sandbox/index": typeof sandbox_index;
  "sandbox/types": typeof sandbox_types;
  telegram: typeof telegram;
  telegramApi: typeof telegramApi;
  threads: typeof threads;
  tools: typeof tools;
  workflow: typeof workflow;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
