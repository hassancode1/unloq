/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminStats from "../adminStats.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as curatedPaths from "../curatedPaths.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as lib_demoFacts from "../lib/demoFacts.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_requireAdmin from "../lib/requireAdmin.js";
import type * as lib_revenuecat from "../lib/revenuecat.js";
import type * as lib_xp from "../lib/xp.js";
import type * as paths from "../paths.js";
import type * as pathsAi from "../pathsAi.js";
import type * as progress from "../progress.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminStats: typeof adminStats;
  ai: typeof ai;
  auth: typeof auth;
  courses: typeof courses;
  crons: typeof crons;
  curatedPaths: typeof curatedPaths;
  groups: typeof groups;
  http: typeof http;
  "lib/demoFacts": typeof lib_demoFacts;
  "lib/gemini": typeof lib_gemini;
  "lib/requireAdmin": typeof lib_requireAdmin;
  "lib/revenuecat": typeof lib_revenuecat;
  "lib/xp": typeof lib_xp;
  paths: typeof paths;
  pathsAi: typeof pathsAi;
  progress: typeof progress;
  usage: typeof usage;
  users: typeof users;
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

export declare const components: {};
