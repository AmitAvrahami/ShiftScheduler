# Shift Scheduling Constraints

## Hard Constraints

These are strict rules that the scheduling algorithm must satisfy. A schedule is considered invalid if any of these constraints are violated.

### Employee Constraints

1. **No Overlapping Shifts:** An employee cannot be assigned to two shifts at the same time.
2. **Minimum Rest Period:** There must be a minimum of 8 hours of rest between shifts for any given employee.
3. **Maximum Daily Hours:** An employee cannot exceed their maximum allowed working hours per day.
4. **Availability:** An employee must be explicitly available on the date and during the specific hours of a shift to be assigned to it.
5. **Special Assignments:** If an employee has a special preference or requirement that mandates specific shifts, they must be assigned to those specific shifts.

### Shift Requirements

1. **Minimum Coverage:** Each shift must have at least the minimum required number of employees assigned to it.
2. **Predefined Shift Types:** Shifts must adhere to predefined types (e.g., Morning, Evening, Night) or custom types defined by the user.
3. **Fixed/Allowed Hours:** Shift hours must be within the fixed boundaries or explicitly reported as allowed.

### System Legality & Labor Laws

1. **Vacation & Time Off:** It is impossible to assign a shift to an employee who is on vacation.
2. **Maximum Consecutive Days:** An employee cannot exceed the maximum number of consecutive working days (e.g., maximum of 6 days in a row).
3. **Weekly Rest Day:** Every employee must have at least one weekly rest day (if relevant according to local labor laws or company policy).

## Soft Constraints

These are preferences that the system will try to honor. A schedule is still valid if these are broken, but the algorithm should minimize violations to produce the most optimal and fair schedule.

### Individual Preferences

1. **Preferred Shift Types:** Honoring an employee's preference for a certain type of shift.
2. **Preferred/Non-Preferred Days:** Honoring requests to work or not work on specific days.
3. **Night Shift Dispreference:** Honoring preferences not to work night shifts.
4. **Fair Personal Requests:** Accommodating reasonable, one-off personal requests.

### Fairness & Even Distribution

1. **Distribution of Problematic Shifts:** Ensuring an equal distribution of less desirable shifts (e.g., night shifts) among all employees.
2. **Distribution of Weekends:** Ensuring an equal distribution of weekend shifts among all employees.
3. **Balancing Hours:** Balancing the total number of working hours fairly among employees.
4. **Avoiding Overload:** Preventing any single employee from being overloaded with work compared to others.

### Sequence & Stability

1. **Convenient Work Sequence:** Avoiding difficult sequences, such as scheduling a night shift followed immediately by a morning shift the next day.
2. **Shift Sequence Stability:** Maintaining a similar shift sequence for an employee to provide stability (e.g., grouping morning shifts together).
3. **Preventing Rapid Switches:** Minimizing frequent switches between completely different types of shifts (e.g., preventing morning -> night -> evening in rapid succession).
