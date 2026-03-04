# Project: Shift Scheduler - Automatic Work Schedule System (MVP)

## Project Overview

Build an automatic shift scheduling system for control rooms and workplaces with rotating shifts. The system allows managers to create optimal work schedules while respecting employee constraints and ensuring full shift coverage.

This is a **Portfolio Project** - Phase 1 focuses on Bezeq's control room (10 employees, 3 shifts).

## Business Context

- **Current Problem:** Creating weekly schedules is manual, time-consuming, and error-prone
- **Solution:** Automated system where employees submit constraints → system generates optimal schedule → manager reviews and publishes
- **Target Users:** 10 employees (1 manager + 9 shift workers) at Bezeq control room

## Core Requirements - MVP

### 1. Shift Types (3 shifts, 24/7 coverage)

- **Morning:** 06:45 - 14:45 (8 hours)
- **Afternoon:** 14:45 - 22:45 (8 hours)
- **Night:** 22:45 - 06:45 (8 hours)

### 2. Coverage Requirements

**Weekdays (Sun-Thu):**

- Morning: 2 employees (including manager)
- Afternoon: 2 employees
- Night: 1 employee

**Weekends (Fri morning - Sat night):**

- Friday morning: 2 employees
- All other shifts: 1 employee each

### 3. Hard Constraints (MUST be enforced)

- Manager always works morning shift
- Minimum 8 hours rest between shifts
- Full coverage for all shifts (alert if impossible)
- Employee constraints must be respected ("cannot work" = no assignment)
- Constraint submission deadline: Monday 23:59

### 4. Soft Constraints (TRY to enforce)

- Balance shift distribution among employees
- Equal distribution of morning/afternoon/night shifts
- Minimize consecutive night shifts (max 3 if possible)

### 5. Weekly Workflow

- Employees submit constraints (up to Monday)
- Manager generates schedule (Tuesday)
- Manager reviews and publishes schedule (Wednesday)
- Schedule week: Sunday to Saturday
