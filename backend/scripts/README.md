# Backend Scripts

This directory contains manual utility scripts **not** part of the automated test suite.

## `api_tests.js`

Integration smoke-test script for manual API verification.  
Requires a running server at `http://127.0.0.1:5001` and seeded test users.

**Usage:**
```bash
npm run test:api
```

> **Note:** This is not a substitute for the automated Jest tests in `src/`.
