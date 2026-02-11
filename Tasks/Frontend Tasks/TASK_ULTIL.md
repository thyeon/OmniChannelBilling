Objective:  1. Utility Function, refer to the following code

Create src/lib/utils.ts to handle class merging cleanly:

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

## Contraints
- Skil Backend Stack and Persistent Layer initialization
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
