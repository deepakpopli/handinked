#!/usr/bin/env python3
"""Print spaced review days between today and an interview or exam date.

Usage: python3 study_plan.py --date 2026-11-24 [--start 2026-11-11]

The gap between sessions follows the spacing research in rough form
(Cepeda et al. 2008): about 1 to 2 days when the test is a week away,
3 to 6 days when it is 2 to 3 weeks away. Every plan ends with a spoken
run-through the day before and a recap-only look on the day.
"""
import argparse
import datetime as dt


def gap_for(days_left):
    if days_left <= 4:
        return 1
    if days_left <= 10:
        return 2
    if days_left <= 24:
        return max(3, min(6, round(days_left * 0.25)))
    return 7


def plan(start, target):
    days = (target - start).days
    if days < 0:
        raise SystemExit("study_plan: the date is in the past")
    if days == 0:
        return [(start, "today: recap page only. Say each answer out loud once.")]
    if days == 1:
        return [
            (start, "learn: read once, close the page, answer the questions out loud, check"),
            (start, "evening: second recall round, then sleep"),
            (target, "interview day: recap page only"),
        ]
    gap = gap_for(days)
    sessions = [(start, "learn: read once, close the page, answer the questions out loud, check")]
    day = start + dt.timedelta(days=gap)
    last = target - dt.timedelta(days=1)
    n = 1
    while day < last:
        # Leave at least a day before the final run-through.
        if (last - day).days >= 1:
            n += 1
            sessions.append((day, f"recall {n - 1}: questions first, pages closed, out loud. Reread only what you missed"))
        day += dt.timedelta(days=gap)
    sessions.append((last, "run-through: every question out loud, as if in the room. Sleep on time"))
    sessions.append((target, "interview day: recap page only, nothing new"))
    return sessions


def main():
    ap = argparse.ArgumentParser(description="Spaced review days up to an interview or exam date.")
    ap.add_argument("--date", required=True, help="interview or exam date, YYYY-MM-DD")
    ap.add_argument("--start", help="first study day, YYYY-MM-DD (default: today)")
    args = ap.parse_args()
    start = dt.date.fromisoformat(args.start) if args.start else dt.date.today()
    target = dt.date.fromisoformat(args.date)
    sessions = plan(start, target)
    days = (target - start).days
    print(f"{days} days to go, {len(sessions)} sessions")
    for day, what in sessions:
        offset = (day - start).days
        print(f"{day.isoformat()}  {day.strftime('%a %d %b')}  day {offset:<3} {what}")
    recalls = sum(1 for _, what in sessions if what.startswith(("recall", "run-through", "evening")))
    if recalls < 3 and days > 1:
        print("note: fewer than 3 recall sessions fit. Add a second short recall round on the first day.")


if __name__ == "__main__":
    main()
