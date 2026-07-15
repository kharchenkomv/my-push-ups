# My Push Ups App – Methodological Specification

## 1. Habit Session

Habit Session is the only training mode in the app.[cite:32][cite:41]

### 1.1 Frequency and structure

- Frequency: **7 days per week**.
- Session format: **5 rounds** per day.
- Rest between rounds: user-defined in settings, with a maximum of **2 minutes**.[cite:32][cite:6]
- Session logic must stay submaximal and technique-focused, not failure-focused.[cite:32][cite:41]

### 1.2 Rep structure per session

The app should not use the same number of reps in every round. A descending structure is more suitable for beginners and daily habit training because fatigue accumulates during repeated push-up sets, while technique should stay clean across all 5 rounds.[cite:32][cite:39][cite:41]

Default round structure:

- Round 1: **100%** of the daily target reps.
- Round 2: **90%** of the daily target reps.
- Round 3: **85%** of the daily target reps.
- Round 4: **80%** of the daily target reps.
- Round 5: **75%** of the daily target reps.

This descending model spreads fatigue more evenly than a steep drop such as 100/80/70/70/50, and keeps later rounds meaningful for adaptation instead of turning them into near-recovery sets.[cite:32][cite:39][cite:41]

### 1.3 Daily target calculation

The daily target must be based on the user’s current maximum number of technically correct repetitions in the selected push-up variation.

Recommended formula:

1. Compute `daily_target = floor(max_reps × 0.5)`.
2. Apply a lower bound of **2 reps**.
3. Apply conservative upper caps to keep sessions sustainable:
   - Wall push-ups: cap at 15.
   - Incline push-ups: cap at 12.
   - Knee push-ups: cap at 10.
   - Full push-ups: cap at 8 in the base phase.[cite:32][cite:41]

The 5 round targets are then derived from `daily_target` using the percentage model above.

Example for `daily_target = 10`:

- Round 1: 10
- Round 2: 9
- Round 3: 8 or 9 (rounding rule defined by implementation)
- Round 4: 8
- Round 5: 7 or 8

The implementation may round to the nearest whole number, but it should preserve the descending pattern.

### 1.4 Session types inside the 7-day plan

Because the plan runs every day, the app should use more than one session intensity.

#### Standard Habit Session

Used on normal training days.

- Full `daily_target`.
- 5 rounds using 100/90/85/80/75%.
- Intended to provide the main training stimulus.[cite:32][cite:41]

#### Lighter Habit Session

Used to reduce fatigue while preserving the daily habit and movement pattern.[cite:44]

- Use about **80–85%** of the standard `daily_target`.
- Keep the same 5-round descending structure.
- Best used after harder days, higher soreness, poor sleep, or higher RPE reports.[cite:44][cite:49]

#### Easy Technique Session

Used when recovery is limited or when the user needs to reinforce form.

- Use about **60–70%** of the standard `daily_target`.
- Same 5-round structure, but all reps must feel easy and technically precise.
- Emphasise body alignment, tempo, and pain-free movement instead of workload.[cite:44][cite:49]

A separate test-style session is excluded from this specification.

### 1.5 Suggested weekly pattern

To support daily training without turning every day into a hard day, the app should distribute session types across the week as follows:

- Day 1: Standard Habit Session
- Day 2: Lighter Habit Session
- Day 3: Standard Habit Session
- Day 4: Easy Technique Session
- Day 5: Standard Habit Session
- Day 6: Lighter Habit Session
- Day 7: Standard Habit Session

This keeps the user on a 7-day habit plan while still respecting recovery principles.[cite:44][cite:32]

## 2. Progression

### 2.1 Weekly progression rule

The app must store:

- sessions completed,
- round-by-round completion,
- RPE after each session on a 1 to 10 scale,
- optional pain or recovery feedback.

Progression rules:

- If the user completes at least **6 of 7 sessions**, completes all rounds as prescribed, and average RPE is **7 or lower**, increase `daily_target` by **+1 rep** for the next week.[cite:32][cite:39]
- If average RPE is **8 or higher**, if rounds are frequently missed, or if recovery feedback is poor, keep the same `daily_target` or reduce it by **1 rep**.[cite:32][cite:44]
- Increases must remain conservative, and the app should avoid abrupt jumps in weekly total volume.[cite:32][cite:41]

### 2.2 Re-test rule

The app may prompt a new max-repetition test every **3–4 weeks** to refresh `max_reps` and recalculate `daily_target`.[cite:32][cite:41]

## 3. Safety, feedback and execution

### 3.1 Safety and feedback

Training logic must prioritise technique and recovery.

- The user should stop the set when form breaks down.
- If wrist, shoulder, elbow, or chest pain occurs, the app should recommend reducing reps, using an easier variation, or stopping the session.[cite:44]
- RPE and pain feedback must influence the next sessions and weekly progression.[cite:32][cite:44]

### 3.2 UI logic

For each round:

1. Show the prescribed reps inside the large circle.
2. User completes the round and taps the circle.
3. The app starts the configured rest timer.
4. After rest, the app advances to the next round.
5. At the end of round 5, mark the session complete and store feedback.

## 4. Integration with UI

The methodology must map directly to the app interface:

- The big circle shows the rep target for the current round.
- The screen shows the round index, for example “Round 3 of 5”.
- After completion of a round, the rest timer starts automatically.
- Rest duration comes from user settings but cannot exceed 2 minutes.
- The next day’s session type and reps are generated from the weekly pattern plus progression rules.

## 5. Scope of this specification

This specification describes only the methodology for a habit-only push-up app with 7 days per week planning, 5 rounds per session, descending reps, configurable rest, and progression based on completion and recovery.[cite:32][cite:41]

Strength training as a separate mode is fully excluded.
