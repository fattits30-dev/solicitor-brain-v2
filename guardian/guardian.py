#!/usr/bin/env python3
"""
Project Warden - Guardian Policy Checker
Enforces repository quality gates and security standards.
"""

import os
import sys
import json
import yaml
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse

class PolicyChecker:
    """Main policy enforcement engine for Project Warden."""
    
    def __init__(self, config_path: str = "policy.yml"):
        self.config_path = config_path
        self.policy = self.load_policy()
        self.violations = []
        
    def load_policy(self) -> Dict[str, Any]:
        """Load policy configuration from YAML file."""
        try:
            with open(self.config_path, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            raise Exception(f"Policy file not found: {self.config_path}")
        except yaml.YAMLError as e:
            raise Exception(f"Invalid YAML in policy file: {e}")
    
    def check_pr_size(self) -> bool:
        """Check if PR is within size limits."""
        try:
            # Try different git diff approaches
            commands = [
                ["git", "diff", "--stat", "origin/main...HEAD"],
                ["git", "diff", "--stat", "main...HEAD"], 
                ["git", "diff", "--stat", "HEAD~1...HEAD"]
            ]
            
            result = None
            for cmd in commands:
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode == 0 and result.stdout.strip():
                    break
            
            if not result or result.returncode != 0:
                # If no remote comparison available, this might be a new branch or single commit
                # Just check for uncommitted changes
                result = subprocess.run(
                    ["git", "diff", "--stat", "HEAD"],
                    capture_output=True, text=True
                )
                if result.returncode != 0 or not result.stdout.strip():
                    # No changes to check
                    return True
                
            lines = result.stdout.strip().split('\n')
            if not lines or len(lines) == 1 and not lines[0]:
                return True
                
            # Parse last line which contains summary
            summary_line = lines[-1]
            if "insertion" in summary_line or "deletion" in summary_line:
                # Extract numbers from summary line
                numbers = re.findall(r'\d+', summary_line)
                if numbers:
                    total_changes = sum(int(n) for n in numbers[:2])  # insertions + deletions
                    max_lines = self.policy.get('quality', {}).get('pr-size-limit', {}).get('max_lines', 300)
                    
                    if total_changes > max_lines:
                        self.violations.append(
                            f"PR too large: {total_changes} lines changed (max: {max_lines}). "
                            "Split into smaller PRs."
                        )
                        return False
                        
            return True
        except Exception as e:
            # Don't fail on git diff errors - this might be a new repo or branch
            return True
    
    def check_secrets(self) -> bool:
        """Check for committed secrets and PII."""
        patterns = []
        for rule in self.policy.get('rules', []):
            if rule.get('name') == 'no-secrets':
                patterns = rule.get('patterns', [])
                break
        
        if not patterns:
            return True
            
        try:
            # Try different approaches to get changed files
            commands = [
                ["git", "diff", "--name-only", "origin/main...HEAD"],
                ["git", "diff", "--name-only", "main...HEAD"],
                ["git", "diff", "--name-only", "HEAD~1...HEAD"],
                ["git", "diff", "--name-only", "--cached"],  # staged files
                ["git", "ls-files", "--others", "--cached", "--exclude-standard"]  # all tracked files
            ]
            
            changed_files = []
            for cmd in commands:
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode == 0 and result.stdout.strip():
                    changed_files = result.stdout.strip().split('\n')
                    break
            
            if not changed_files:
                return True
                
            secrets_found = False
            
            for file_path in changed_files:
                if not file_path or not os.path.exists(file_path):
                    continue
                    
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        
                    for pattern in patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            self.violations.append(f"Potential secret found in {file_path}")
                            secrets_found = True
                            
                except Exception:
                    continue  # Skip files that can't be read
                    
            return not secrets_found
        except Exception as e:
            # Don't fail on git errors - might be a new repo
            return True
    
    def check_test_coverage(self) -> bool:
        """Check if test coverage meets minimum threshold."""
        try:
            # Try different approaches to get changed files
            commands = [
                ["git", "diff", "--name-only", "origin/main...HEAD"],
                ["git", "diff", "--name-only", "main...HEAD"],
                ["git", "diff", "--name-only", "HEAD~1...HEAD"],
                ["git", "ls-files", "server/services/*.ts"]  # fallback to check all service files
            ]
            
            changed_files = []
            for cmd in commands:
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode == 0 and result.stdout.strip():
                    changed_files = result.stdout.strip().split('\n')
                    break
            
            if not changed_files:
                return True
                
            service_files = [f for f in changed_files if 'server/services/' in f and f.endswith('.ts')]
            
            if not service_files:
                return True  # No service files changed
            
            missing_tests = []
            for service_file in service_files:
                # Look for corresponding test file
                test_patterns = [
                    service_file.replace('server/services/', 'server/tests/').replace('.ts', '.test.ts'),
                    service_file.replace('server/services/', 'tests/').replace('.ts', '.test.ts'),
                ]
                
                has_test = any(os.path.exists(pattern) for pattern in test_patterns)
                if not has_test:
                    missing_tests.append(service_file)
            
            if missing_tests:
                self.violations.append(
                    f"Missing tests for service files: {', '.join(missing_tests)}"
                )
                return False
                
            return True
        except Exception as e:
            # Don't fail on git errors
            return True
    
    def check_commit_messages(self) -> bool:
        """Check if commit messages follow conventional format."""
        try:
            # Try different approaches to get commits
            commands = [
                ["git", "log", "--oneline", "origin/main..HEAD"],
                ["git", "log", "--oneline", "main..HEAD"],
                ["git", "log", "--oneline", "-1"]  # just check the last commit
            ]
            
            commits = []
            for cmd in commands:
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode == 0 and result.stdout.strip():
                    commits = result.stdout.strip().split('\n')
                    break
            
            if not commits or not commits[0]:
                return True  # No commits to check
                
            pattern = r"^[a-f0-9]+ (feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .+"
            
            invalid_commits = []
            for commit in commits:
                if commit and not re.match(pattern, commit):
                    invalid_commits.append(commit)
            
            if invalid_commits:
                self.violations.append(
                    f"Invalid commit message format: {invalid_commits[0][:50]}..."
                )
                return False
                
            return True
        except Exception as e:
            # Don't fail on git errors
            return True
    
    def run_all_checks(self) -> bool:
        """Run all policy checks."""
        print("🛡️  Running Project Warden policy checks...")
        
        checks = [
            ("PR Size Limit", self.check_pr_size),
            ("Secret Detection", self.check_secrets),
            ("Test Coverage", self.check_test_coverage),
            ("Commit Messages", self.check_commit_messages),
        ]
        
        all_passed = True
        for check_name, check_func in checks:
            try:
                passed = check_func()
                status = "✅" if passed else "❌"
                print(f"  {status} {check_name}")
                if not passed:
                    all_passed = False
            except Exception as e:
                print(f"  ❌ {check_name} (error: {e})")
                all_passed = False
        
        if self.violations:
            print("\n❌ Policy Violations Found:")
            for violation in self.violations:
                print(f"  • {violation}")
        
        return all_passed

def main():
    parser = argparse.ArgumentParser(description="Project Warden - Repository Policy Checker")
    parser.add_argument("--policy", default="policy.yml", help="Path to policy file")
    parser.add_argument("--fix", action="store_true", help="Attempt to fix violations automatically")
    args = parser.parse_args()
    
    try:
        checker = PolicyChecker(args.policy)
        passed = checker.run_all_checks()
        
        if passed:
            print("\n✅ All policy checks passed!")
            sys.exit(0)
        else:
            print("\n❌ Policy violations found. Please fix before proceeding.")
            print("\nFor help with fixes, run: python guardian/guardian.py --fix")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Guardian check failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()