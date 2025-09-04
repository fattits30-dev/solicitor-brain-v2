#!/usr/bin/env node
/* eslint-env node */
/* global process, console */
/* eslint-disable no-unused-vars */
/**
 * Safe PR assistant: posts a short, non-sensitive summary comment on PRs.
 * This script intentionally never makes code changes.
 */
const fs = require('fs');
const { Octokit } = require('@octokit/rest');

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    console.error('GITHUB_EVENT_PATH not available; exiting safely');
    return;
  }

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const pr = event.pull_request;
  if (!pr) {
    console.log('Not a pull_request event; nothing to do');
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('GITHUB_TOKEN not provided; skipping comment to avoid failures');
    return;
  }

  const octokit = new Octokit({ auth: token });

  // Read simple outputs if present (do not read or post any secrets)
  let lintSummary = '';
  if (fs.existsSync('eslint-summary.txt')) {
    lintSummary = fs.readFileSync('eslint-summary.txt', 'utf8').trim();
  }

  let testSummary = '';
  if (fs.existsSync('test-results.json')) {
    try {
      const tr = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
      testSummary = `Tests: ${tr.numTotalTests || 0} total, ${tr.numFailedTests || 0} failed`;
    } catch (e) {
      // ignore malformed test output (log short message for debugging)

      console.debug('Malformed test-results.json, ignoring');
    }
  }

  const body = [
    'Automated suggestion (safe mode):',
    `- Lint summary: ${lintSummary || 'no issues detected or output unavailable'}`,
    `- Test summary: ${testSummary || 'no results'}`,
    '',
    'This assistant is read-only. To enable automated patch suggestions, add an `OLLAMA_BASE_URL` repository secret and follow the repository CONTRIBUTING.md for opt-in steps.',
  ].join('\n');

  await octokit.rest.issues.createComment({
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    issue_number: pr.number,
    body,
  });
}

main().catch((err) => {
  // Log error but do not fail the workflow critically
  console.error('compose-suggestion error:', err && err.message ? err.message : err);
});
