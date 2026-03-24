# Contributing Guide

Thank you for contributing to the Lucena City Disaster Risk Reduction Management Office project.

## Workflow

1. Fork the repository.
2. Create a feature branch from `main`.
3. Make your changes.
4. Run checks and tests.
5. Commit using clear commit messages.
6. Push your branch.
7. Open a Pull Request to `main`.

## Branch Naming

Use one of these formats:

- `feature/<short-description>`
- `fix/<short-description>`
- `docs/<short-description>`
- `refactor/<short-description>`

Examples:

- `feature/admin-report-filters`
- `fix/login-otp-validation`
- `docs/update-system-flow`

## Commit Message Format

Prefer conventional-style prefixes:

- `feat: add incident export endpoint`
- `fix: handle expired otp on login`
- `docs: update deployment diagram`
- `refactor: simplify dashboard routing`

## Pull Request Checklist

Before opening a PR, confirm:

- [ ] The branch is up to date with `main`.
- [ ] Changes are focused on one concern.
- [ ] Documentation is updated if behavior changed.
- [ ] No unrelated files are modified.
- [ ] Frontend builds successfully.
- [ ] Backend starts without errors.

## Local Run Commands

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver
```

## Reporting Issues

When filing issues, include:

- Expected behavior
- Actual behavior
- Steps to reproduce
- Screenshots or logs if available

## Code Style

- Keep changes small and reviewable.
- Preserve existing project structure and naming.
- Avoid broad refactors in feature-specific PRs.
- Update docs in `docs/` when diagrams or flows change.
