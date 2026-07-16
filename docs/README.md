# GHE Compliance Dashboard — Documentation

## Project Overview

A full-stack compliance management system for tracking Gifts, Hospitality & Entertainment declarations. Built with Express + TypeScript + Prisma (backend) and React + Vite (frontend).

## Documentation Index

### Project-level (`docs/`)
| File | Description |
|------|-------------|
| `ARCHITECTURE.md` | System architecture, data flow, key design decisions |
| `README.md` | This file |

### Backend (`NodejsBackend/docs/`)
| File | Description |
|------|-------------|
| `TESTING.md` | API endpoint test guide with curl/PowerShell examples, preset users, test coverage summary |

### Frontend (`Enterprise Compliance Platform/docs/`)
| File | Description |
|------|-------------|
| `TESTING.md` | Frontend test commands, component coverage, mock strategy |

## Quick Links

- **Swagger UI**: `http://localhost:3001/api/docs` (start backend first)
- **Backend Tests**: `cd NodejsBackend && npm test` (203 tests)
- **Frontend Tests**: `cd "Enterprise Compliance Platform" && npm test` (156 tests)
- **Total**: 359 tests

## Test Data

Preset users (all password: `password`):

| Role | Email |
|------|-------|
| Admin | admin@hb.co.za |
| Approver (LM) | sipho@hb.co.za |
| Approver (HR) | lindiwe@hb.co.za |
| Approver (CEO) | sandile@hb.co.za |
| Team Member | nomvula@hb.co.za |
