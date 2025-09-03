# Repository Maintenance Guide

## 🧹 Keeping the Repository Clean

This guide documents best practices and procedures for maintaining a clean, efficient repository.

## Table of Contents

- [Preventing node_modules in Git](#preventing-node_modules-in-git)
- [Repository Size Management](#repository-size-management)
- [CI/CD Enforcement](#cicd-enforcement)
- [Emergency Cleanup Procedures](#emergency-cleanup-procedures)
- [Regular Maintenance Tasks](#regular-maintenance-tasks)

## Preventing node_modules in Git

### Why It Matters

- **Security**: Dependencies can contain vulnerabilities
- **Performance**: Reduces repository size by 90%+
- **Conflicts**: Avoids merge conflicts in dependency files
- **Best Practice**: Dependencies should be installed, not committed

### Prevention Measures

1. **`.gitignore` Configuration**

   ```gitignore
   node_modules/
   **/node_modules/
   ```

2. **CI Enforcement**
   - The `gitignore-check.yml` workflow runs on every push
   - Automatically detects and blocks commits with node_modules
   - Provides clear instructions for fixing violations

3. **Pre-commit Hooks**
   - Husky pre-commit hooks prevent accidental commits
   - Automatically runs linting and formatting

### If node_modules Gets Committed

**Immediate Fix:**

```bash
# Remove from current commit
git rm -r --cached node_modules/
git commit -m "fix: remove node_modules from tracking"
git push
```

**Clean History (if needed):**

```bash
# Download BFG Repo Cleaner
wget -O bfg.jar https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Remove from entire history
java -jar bfg.jar --delete-folders node_modules --no-blob-protection .git

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (coordinate with team!)
git push --force-with-lease
```

## Repository Size Management

### Monitoring Size

```bash
# Check repository size
du -sh .git

# Detailed statistics
git count-objects -vH

# Find large files
find . -type f -size +1M ! -path "./.git/*" ! -path "./node_modules/*" -exec ls -lh {} \;
```

### Size Targets

- **Ideal**: < 100MB
- **Acceptable**: < 250MB
- **Warning**: > 250MB
- **Critical**: > 500MB

### Common Size Issues

1. **Binary Files**
   - Move to CDN or cloud storage
   - Use Git LFS for necessary large files
   - Add to .gitignore

2. **Build Artifacts**

   ```gitignore
   dist/
   build/
   *.bundle.js
   ```

3. **Test Data**
   - Use smaller test fixtures
   - Generate test data programmatically
   - Store in separate test data repository

## CI/CD Enforcement

### Automated Checks

The repository includes several CI workflows that enforce cleanliness:

1. **GitIgnore Check** (`gitignore-check.yml`)
   - Verifies no ignored files are tracked
   - Checks repository size
   - Validates .gitignore completeness

2. **Dependency Audit** (in `ci.yml`)
   - Runs `npm audit` on every build
   - Reports high-severity vulnerabilities
   - Non-blocking but highly visible

### Adding New Checks

To add a new enforcement rule:

1. Create workflow in `.github/workflows/`
2. Add to required status checks in GitHub settings
3. Document in this guide

## Emergency Cleanup Procedures

### Scenario: Repository Too Large

```bash
# 1. Analyze what's taking space
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  sed -n 's/^blob //p' | \
  sort --numeric-sort --key=2 | \
  tail -20

# 2. Remove large files from history
java -jar bfg.jar --strip-blobs-bigger-than 10M

# 3. Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Scenario: Sensitive Data Committed

```bash
# Use BFG to remove sensitive data
java -jar bfg.jar --replace-text passwords.txt

# Or remove specific files
java -jar bfg.jar --delete-files config.env

# Clean and force push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease
```

## Regular Maintenance Tasks

### Weekly

- [ ] Check repository size: `du -sh .git`
- [ ] Review dependency updates: `npm outdated`
- [ ] Check for security alerts: `npm audit`

### Monthly

- [ ] Review and update .gitignore
- [ ] Clean up old branches
- [ ] Analyze large files
- [ ] Review CI workflow performance

### Quarterly

- [ ] Full repository audit
- [ ] Consider history cleanup if > 250MB
- [ ] Update this documentation
- [ ] Review team practices

## Best Practices

### DO ✅

- Commit early and often (small commits)
- Use .gitignore proactively
- Review file sizes before committing
- Use `git status` before every commit
- Keep binary files out of the repository
- Use environment variables for secrets

### DON'T ❌

- Commit node_modules
- Commit .env files
- Commit large binary files
- Commit build artifacts
- Commit test coverage reports
- Force push without team coordination

## Tools and Resources

### Essential Tools

- **BFG Repo Cleaner**: Fast repository cleaning
- **git-filter-repo**: Alternative to BFG
- **git-sizer**: Analyze repository size issues
- **GitHub Desktop**: Visual repository management

### Useful Commands

```bash
# Check what will be committed
git status

# See file sizes in staging
git ls-files --stage | awk '{print $4}' | xargs -I {} ls -lh {}

# Find files by extension
find . -name "*.log" -o -name "*.tmp"

# Clean untracked files (careful!)
git clean -fdx --dry-run  # Preview
git clean -fdx             # Execute
```

## Getting Help

If you encounter issues:

1. Check this documentation
2. Run the automated checks
3. Ask in the team chat
4. Create an issue if it's a recurring problem

## Automation Scripts

### cleanup.sh

Create this script in the project root:

```bash
#!/bin/bash
# Repository cleanup script

echo "🧹 Starting repository cleanup..."

# Remove common unnecessary files
find . -name "*.log" -delete
find . -name "*.tmp" -delete
find . -name ".DS_Store" -delete
find . -name "Thumbs.db" -delete

# Check repository size
SIZE=$(du -sh .git | cut -f1)
echo "📊 Repository size: $SIZE"

# Run git gc
git gc --auto

echo "✅ Cleanup complete!"
```

Make it executable: `chmod +x cleanup.sh`

---

**Remember**: A clean repository is a happy repository! 🎉

For questions or suggestions about this guide, please open an issue or PR.
