# Security Policy

## Supported Versions

We provide security updates for the latest version of KPIBoard.

## Reporting a Vulnerability

### How to Report

1. Go to the [Security tab](../../security/advisories) of this repository
2. Click "Report a vulnerability"
3. Fill out the advisory form with as much detail as possible

### Scope

Please report any security issues related to:

- **Codebase vulnerabilities**: Authentication bypasses, injection flaws, XSS, CSRF, insecure dependencies, etc.
- **API security**: Jira token handling, data exposure, improper access control
- **Configuration issues**: Exposed secrets, misconfigured environment variables

### What to Include

- **Description**: Clear explanation of the vulnerability
- **Impact**: What an attacker could achieve
- **Steps to reproduce**: Detailed instructions to verify the issue
- **Affected components**: Which parts of the system are vulnerable
- **Suggested fix** (optional): Your recommendation for remediation

### Response Timeline

- **Acknowledgment**: Within 48 hours of submission
- **Initial assessment**: Within 5 business days
- **Resolution**: Depends on severity

## Disclosure Policy

We follow a **coordinated disclosure** process:

- Please give us a reasonable time to address the issue before public disclosure
- We will credit you in the security advisory (unless you prefer anonymity)

## Out of Scope

- Vulnerabilities in dependencies that are already publicly known
- Issues that require physical access to a user's device
- Social engineering attacks
- Denial of service attacks
