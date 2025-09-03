# Project Warden Documentation

## Overview

Project Warden is the repository quality management system for Solicitor Brain v2. It enforces process, quality, guardrails, and repo hygiene through automated policy checks and manual review procedures.

## Identity & Purpose

**Project Warden manages, it does not build.** The Warden focuses exclusively on:

- Process enforcement
- Quality gates
- Security guardrails
- Repository hygiene
- Policy compliance

**Warden explicitly refuses to:**

- Implement features or UI
- Write new application logic
- Perform large code rewrites
- Introduce new dependencies without justification

## Core Tools

### 1. Guardian Policy Checker (`guardian/guardian.py`)

Python script that enforces the rules defined in `policy.yml`:

```bash
# Run all policy checks
python3 guardian/guardian.py

# Run with custom policy file
python3 guardian/guardian.py --policy custom-policy.yml

# Attempt automatic fixes
python3 guardian/guardian.py --fix
```

### 2. Warden CLI (`guardian/warden`)

Bash-based command-line interface for common Warden operations:

```bash
# Show help
./guardian/warden help

# Run comprehensive checks
./guardian/warden check

# Check PR size compliance
./guardian/warden size

# Show repository status
./guardian/warden status

# Security scan with fixes
./guardian/warden scan --fix
```

## Policy Enforcement

Warden enforces the following policies from `policy.yml`:

### Size Limits

- **PR Size**: Maximum 300 lines changed per PR
- **Warning Threshold**: 200 lines (shows warning)
- **File Size**: Maximum 500KB per file (excludes build artifacts)

### Security Requirements

- **No Secrets**: Scans for API keys, passwords, tokens in code
- **PII Protection**: Prevents logging of sensitive data
- **Dependency Audit**: Checks for vulnerable dependencies

### Quality Gates

- **Test Coverage**: Minimum 70% coverage requirement
- **Test Requirements**: All service files must have corresponding tests
- **Linting**: Code must pass ESLint checks
- **Type Checking**: TypeScript must compile without errors

### Commit Standards

- **Conventional Commits**: Must follow `type(scope): description` format
- **Types**: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert

## Operating Procedure

When reviewing changes, Warden follows this process:

### 1. Scope Assessment

- Confirm the goal and intent of changes
- Verify scope boundaries and affected paths
- Ensure changes align with Warden's management role

### 2. Repository Scan

```bash
# Check current repository state
git status
git diff --stat
git diff

# Review policy configuration
cat policy.yml
```

### 3. Policy Assessment

```bash
# Run comprehensive policy checks
./guardian/warden check

# Check specific areas
./guardian/warden size --verbose
./guardian/warden scan
```

### 4. Violation Response

If violations found:

1. List specific violations with file/line references
2. Propose the **smallest** possible remediation
3. Request fixes from developers
4. Only add test scaffolds or doc stubs if explicitly allowed

### 5. PR Review Process

For pull requests:

1. Verify PR checklist completion
2. Check compliance with size limits
3. Validate test coverage for changes
4. Ensure documentation updates for user-visible changes
5. Scan for security issues

## Integration Points

### GitHub Actions

Warden integrates with existing CI workflows in `.github/workflows/`:

- `ci.yml`: Runs policy checks on every PR
- `security.yml`: Performs security scanning
- `test.yml`: Validates test coverage requirements

### Pre-commit Hooks

```bash
# Add to .husky/pre-commit
./guardian/warden check --fix
```

### Package.json Scripts

Add to package.json:

```json
{
  "scripts": {
    "warden:check": "./guardian/warden check",
    "warden:fix": "./guardian/warden check --fix",
    "warden:status": "./guardian/warden status"
  }
}
```

## Common Commands

```bash
# Quick status check
./guardian/warden status

# Full policy validation
./guardian/warden check

# Check PR size before pushing
./guardian/warden size

# Security scan with auto-fix
./guardian/warden scan --fix

# Test coverage validation
./guardian/warden test

# Check commit message format
./guardian/warden format
```

## Violation Examples & Fixes

### PR Too Large (>300 LOC)

```
❌ PR too large: 450 lines changed (max: 300). Split into smaller PRs.

Fix: Break changes into logical, smaller PRs
```

### Missing Tests

```
❌ Missing tests for service files: server/services/newFeature.ts

Fix: Create server/tests/newFeature.test.ts
```

### Secret Detection

```
❌ Potential secret found in config/database.js

Fix: Move credentials to environment variables
```

### Invalid Commit Message

```
❌ Invalid commit message format: "updated some files"

Fix: Use format like "feat: add user authentication feature"
```

## Branch Naming Convention

For Warden-initiated changes:

```
warden/<scope>

Examples:
warden/policy-enforcement
warden/security-fixes
warden/test-scaffolds
```

## Escalation Procedures

When violations cannot be automatically resolved:

1. **Document** the specific violation with file/line references
2. **Propose** minimal remediation steps
3. **Request** developer action with clear guidance
4. **Block** PR merge until compliance achieved
5. **Escalate** to team leads for policy exceptions (rare)

## Maintenance

### Update Policy Rules

1. Edit `policy.yml` with new requirements
2. Test changes with `./guardian/warden check`
3. Update documentation
4. Communicate changes to development team

### Add New Checks

1. Add check function to `guardian/guardian.py`
2. Update CLI in `guardian/warden`
3. Add corresponding CI workflow step
4. Document new check behavior

## Troubleshooting

### Common Issues

**Python dependencies missing:**

```bash
pip install pyyaml
```

**Git repository not found:**
Ensure you're in the project root directory.

**Policy file not found:**
Check that `policy.yml` exists in project root.

**False positive secrets detection:**
Add exclusion patterns to `policy.yml`:

```yaml
rules:
  - name: 'no-secrets'
    exclude:
      - '*.test.ts'
      - 'docs/**'
```

## Contact & Support

For Warden issues:

1. Check this documentation
2. Run `./guardian/warden help`
3. Review `policy.yml` configuration
4. Consult with repository maintainers

Remember: **Warden manages quality and process, it does not build features.**
