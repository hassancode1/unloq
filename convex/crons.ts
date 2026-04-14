import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup stuck generating courses",
  { minutes: 15 },
  internal.courses.cleanupStuck,
);

export default crons;
