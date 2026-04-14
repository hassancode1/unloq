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
import type * as debug from "../debug.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as lib_requireAdmin from "../lib/requireAdmin.js";
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
  debug: typeof debug;
  groups: typeof groups;
  http: typeof http;
  "lib/requireAdmin": typeof lib_requireAdmin;
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
