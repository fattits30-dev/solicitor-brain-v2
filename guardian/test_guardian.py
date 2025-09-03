#!/usr/bin/env python3
"""
Tests for Project Warden Guardian functionality
"""

import os
import sys
import tempfile
import unittest
from unittest.mock import patch, MagicMock
import subprocess

# Add guardian to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from guardian import PolicyChecker

class TestPolicyChecker(unittest.TestCase):
    
    def setUp(self):
        self.test_policy = {
            'rules': [
                {
                    'name': 'no-secrets',
                    'patterns': [
                        "password\\s*=\\s*['\"][^'\"]+['\"]",
                        "apikey\\s*=\\s*['\"][^'\"]+['\"]"
                    ]
                }
            ],
            'quality': {
                'pr-size-limit': {
                    'max_lines': 300
                }
            }
        }
        
    def test_policy_checker_initialization(self):
        """Test PolicyChecker initializes correctly"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as f:
            f.write("""
rules:
  - name: 'test-rule'
    required: true
""")
            policy_file = f.name
        
        try:
            checker = PolicyChecker(policy_file)
            self.assertIsNotNone(checker.policy)
            self.assertEqual(len(checker.violations), 0)
        finally:
            os.unlink(policy_file)
    
    @patch('subprocess.run')
    def test_check_pr_size_pass(self, mock_run):
        """Test PR size check passes for small changes"""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="file1.txt | 10 +++++++\nfile2.txt | 20 +++++++++++\n 2 files changed, 30 insertions(+)"
        )
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as f:
            f.write("quality:\n  pr-size-limit:\n    max_lines: 300")
            policy_file = f.name
        
        try:
            checker = PolicyChecker(policy_file)
            result = checker.check_pr_size()
            self.assertTrue(result)
            self.assertEqual(len(checker.violations), 0)
        finally:
            os.unlink(policy_file)
    
    @patch('subprocess.run')  
    def test_check_pr_size_fail(self, mock_run):
        """Test PR size check fails for large changes"""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="file1.txt | 200 +++++++\nfile2.txt | 150 +++++++++++\n 2 files changed, 350 insertions(+)"
        )
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as f:
            f.write("quality:\n  pr-size-limit:\n    max_lines: 300")
            policy_file = f.name
        
        try:
            checker = PolicyChecker(policy_file)
            result = checker.check_pr_size()
            self.assertFalse(result)
            self.assertGreater(len(checker.violations), 0)
            self.assertIn("PR too large", checker.violations[0])
        finally:
            os.unlink(policy_file)
    
    def test_check_secrets_with_violation(self):
        """Test secret detection finds violations"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as f:
            f.write("""rules:
- name: 'no-secrets'
  patterns:
  - 'password'
""")
            policy_file = f.name
        
        # Create a test file with a secret
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as test_file:
            test_file.write('const password = "secret123";')
            test_file_path = test_file.name
        
        try:
            checker = PolicyChecker(policy_file)
            # Mock git diff to return our test file
            with patch('subprocess.run') as mock_run:
                mock_run.return_value = MagicMock(
                    returncode=0,
                    stdout=test_file_path
                )
                result = checker.check_secrets()
                self.assertFalse(result)
                self.assertGreater(len(checker.violations), 0)
        finally:
            os.unlink(policy_file)
            os.unlink(test_file_path)
    
    def test_run_all_checks(self):
        """Test running all checks works"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as f:
            f.write("""
rules:
  - name: 'no-secrets'
    patterns: []
quality:
  pr-size-limit:
    max_lines: 300
""")
            policy_file = f.name
        
        try:
            checker = PolicyChecker(policy_file)
            # Mock all subprocess calls to return safe values
            with patch('subprocess.run') as mock_run:
                mock_run.return_value = MagicMock(
                    returncode=0,
                    stdout=""
                )
                result = checker.run_all_checks()
                # Should pass with empty diffs
                self.assertTrue(result)
        finally:
            os.unlink(policy_file)

if __name__ == '__main__':
    unittest.main()