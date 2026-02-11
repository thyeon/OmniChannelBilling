Objective:  Extend the Customer Master Data Module to allow users to configure distinct API credentials and endpoints for the Reconciliation Server, segmented by Service Type (SMS, Email, Whatsapp).

## Context
The current app under Customer Master only allows settings for distinct "Service Provider for distinct Services" but not Reconciliation Server. Each Customer maybe using different Service Provider and Different Reconciliation Server at the same time. 

## Acceptance Criteria
- [ ] Add a new section in the Customer Master Data Module to configure Reconciliation Server Settings
- [ ] Allow users to configure distinct API credentials and endpoints for the Reconciliation Server, segmented by Service Type (SMS, Email, Whatsapp)
- [ ] Ensure the UI/UX design is consistent with the existing Customer Master Data Module
- [ ] Ensure the settings are saved in the database and can be retrieved for each customer

## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
