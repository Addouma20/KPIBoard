---
applyTo: '**/*.ts,**/*.tsx'
---
# Standard: TypeScript good practices

Enforce TypeScript best practices for this project:

* Do not use `Object.setPrototypeOf` when defining custom errors.
* When defining a presentation DTO that enriches a domain type, use an intersection type (`DomainType & { extraField: T }`) instead of manually re-declaring the domain type's fields, so that structural drift is caught at compile time.
* Always use strict typing — never use `any`.
* Use the `Result<T>` pattern for all async functions calling external APIs (Jira).
* Use `as const` objects instead of enums.
* Export all shared interfaces from `src/types/`.
