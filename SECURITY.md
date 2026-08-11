# Security Policy

## Reporting a Vulnerability

If you find a security vulnerability in Healify, please do **not** open a public issue. Instead, report it privately so it can be handled before it is exposed.

Send an email to **security@healify.dev** with as much of the following as possible:

- A description of the vulnerability and the affected component.
- Steps to reproduce it (or a minimal proof of concept).
- The version(s) of Healify affected.
- Any impact you were able to observe.

You will receive an acknowledgment within **48 hours**, and we will keep you updated as the issue is triaged and fixed.

## Scope

Security reports are welcome for anything in the Healify monorepo, including the CLI, the reporters and plugins, the local AI integration, and the GitHub Action. Healify is designed to be 100% local and without network access; anything that breaks that guarantee, exfiltrates data, or runs unintended code is in scope.

## Our Commitment

- **48-hour acknowledgment** of every valid report.
- A fix will be released as soon as possible, depending on severity.
- Reporters will be credited (if they wish) once the fix is public.
- Responsible disclosure: please give us reasonable time to release a fix before disclosing publicly.

## Out of Scope

- Issues that require the attacker to already have local code execution or direct filesystem access.
- Best-practice suggestions without a demonstrated security impact.
- Vulnerabilities in third-party dependencies that are already fixed upstream — report those to the dependency maintainers.
