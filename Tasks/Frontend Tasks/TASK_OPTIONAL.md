Objective:  Make Service Provider Settings for distinct Services Optional. There could be instance where Service Provider is not used for a particular service.

Business Rules : When Service Provider is not selected for a particular service, the calculation of the usage/count of the service shall based upon the count/usage  from the Reconciliation Server. The Billing module in this case doesn't need to worry about the decrepancy and threshold of descrepancy between the Service Provider and Reconciliation Server.

## Context
The current app under Customer Master has made  "Service Provider" settings mandatory. There are instance where "Service Provider" is not used for a particular service for usage tracking and only Reconciliation Server is used. 

## Acceptance Criteria
- Made Service Provider Settings for distinct Services Optional
- UI/UX for this implemnetation must be consistent with the current user journey

## Constraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
