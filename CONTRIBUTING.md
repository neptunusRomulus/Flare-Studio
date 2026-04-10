# Contributing to Flare Studio

Thank you for contributing to Flare Studio! This project is actively developed and your help is welcome. This document explains how to contribute code, tests, and documentation in a way that helps the maintainers review and accept your work quickly.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Branch and PR Workflow](#branch-and-pr-workflow)
- [Development Commands](#development-commands)
- [Code Style and Quality](#code-style-and-quality)
- [Testing](#testing)
- [Pull Request Checklist](#pull-request-checklist)
- [Licensing](#licensing)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

Please act respectfully and professionally. If you do not see an explicit `CODE_OF_CONDUCT.md` file yet, assume the community expects positive, constructive communication and inclusive behavior in issues, PRs, and discussions.

## Getting Started

1. Fork the repository and clone your fork:

```bash
git clone https://github.com/<your-username>/Flare-Studio.git
cd Flare-Studio
```

2. Install dependencies:

```bash
npm install
```

3. Create a branch for your work:

```bash
git checkout -b feature/short-description
```

Use descriptive branch names such as:

- `feature/add-tileset-import`
- `fix/save-crash-on-export`
- `docs/update-readme`

## Branch and PR Workflow

- Create a separate branch for each change.
- Keep branches focused on a single feature or fix.
- Rebase or merge the latest `main-dev2` branch before opening a PR.
- Push your branch to your fork and open a pull request against `main-dev2`.

## Development Commands

These commands are useful while working on the project:

- Start the web renderer only:

```bash
npm run dev
```

- Start Vite and Electron together:

```bash
npm run electron-dev
```

- Build the production renderer:

```bash
npm run build
```

- Run ESLint:

```bash
npm run lint
```

- Run tests:

```bash
npm test
```

## Code Style and Quality

- This project is written in TypeScript and React.
- Keep code readable, maintainable, and consistent with existing styles.
- Prefer small, understandable commits.
- Use clear variable names and add comments when needed.
- Avoid introducing commented-out code or unfinished debugging statements.

### Linting

Run the linter on changed code before opening a PR:

```bash
npm run lint
```

If ESLint reports issues, fix them before submission.

## Testing

When possible, add or update tests for your change.

- Run all tests:

```bash
npm test
```

- If you add new functionality, include a test case for it.
- If your change is only documentation or a small styling fix, explain that in the PR.

## Pull Request Checklist

Before opening a pull request, verify the following:

- [ ] Your branch is based on the latest `main-dev2` branch.
- [ ] Code compiles cleanly and lint passes.
- [ ] Tests pass locally.
- [ ] The PR title is clear and concise.
- [ ] The PR description explains the change, why it is needed, and how to test it.
- [ ] If applicable, screenshots or videos are attached for UI changes.
- [ ] New files include proper license information where required.

## Licensing

This repository is licensed under **GPL-3.0-or-later**.

By contributing to this project, you agree that your contributions will be licensed under the same terms.

## Reporting Issues

When reporting a bug or requesting a feature:

- Provide a clear title.
- Describe the expected behavior and the actual behavior.
- Include steps to reproduce the issue.
- Share any error messages or screenshots if relevant.

## Additional Notes

- If you are unsure how to proceed, open an issue or leave a comment on an existing one before starting work.
- Keep PRs focused and avoid combining unrelated changes.
- Thanks for helping make Flare Studio better!
