# My Push Ups App – Methodological Specification

## 1. Purpose and Target Users

- Target users:
  - Healthy adults with low sport activity (e.g., office workers) who can safely perform light-to-moderate resistance exercise.[cite:12][cite:20]
- Primary goals:
  - Build a daily “morning push-up” habit via very low-volume, submaximal training.
- Increase upper-body strength and endurance toward a user-defined push-up goal (e.g., 30, 50, 100 continuous reps).[cite:3][cite:30]

All training logic must follow modern resistance-training guidelines for beginners (ACSM Position Stand 2026, RT frequency meta-analyses, and push-up progression literature). The app should never push users into excessive volume or all-out failure, especially at beginner levels.[cite:12][cite:18][cite:27][cite:30]

---
  
  ## 2. Levels and Exercise Variations
  
  The app uses four progressive push-up levels:
  
  - Level 0: Wall push-ups (hands on wall, body angled).
- Level 1: Incline push-ups (hands on elevated surface: counter, bench, step).
- Level 2: Knee push-ups (knees on floor).
- Level 3: Full push-ups (standard floor push-ups).

### Level selection rules

Onboarding must select the starting level as follows:
  
  - If the user cannot perform 1 knee push-up with good form → assign Level 0 (wall).
- If the user can perform ≥8 wall push-ups × 3 sets easily → assign Level 1 (incline).
- If the user can perform ≥8 low-incline push-ups but <8 full push-ups → assign Level 2 (knee).
- If the user can perform ≥8 full push-ups with good form → assign Level 3 (full).[cite:30][cite:3]

---
  
  ## 3. Health Screening and Initial Max Test
  
  ### 3.1 Health screening (required before plan generation)
  
  Before creating a training plan, the app must ask basic health questions:
  
  - Cardiovascular disease or uncontrolled hypertension? (yes/no)
- Major joint or spine problems? (yes/no)
- Current chest, shoulder, or wrist pain? (yes/no)

If any serious issue is reported (e.g., cardiovascular disease, uncontrolled BP, major joint problems), the app must:
  
  - Show a clear warning: “Consult a physician or qualified health professional before starting this program.”
- Allow the user to proceed only after acknowledging the warning.[cite:12][cite:20]

### 3.2 Initial max test (per level)

For the selected level, the app runs a single max-rep test:
  
  - User performs 1 set to **technical limit** (stop when form breaks; do not force absolute failure).
- The app records `max_reps` for that level (integer ≥1).
- `max_reps` is the base parameter for daily habit and 3-day strength plans.[cite:3][cite:30]

---
  
  ## 4. Daily Habit Track – “Morning Quick Push-Ups”
  
  ### 4.1 Goal and constraints
  
  - Goal: create a sustainable daily movement habit.
- Constraint: habit sets must be clearly **submaximal**, short (~1–2 minutes), and safe for non-sportive users.[cite:12][cite:20]

### 4.2 Frequency and structure

- Frequency:
  - Default = **daily** (7 days/week).
- User can choose 5–7 days/week (e.g., weekdays only).
- Rounds per habit session:
  - All levels: **1 round** per morning.
- Optional 2nd round if user explicitly taps “Add another round”.

### 4.3 Habit reps per round

For the current level and recorded `max_reps`:
  
  - Compute:
  - `round_reps_habit = floor(max_reps * 0.4)`
- Apply bounds:
  - If `round_reps_habit < 3` → use 3.
- If `round_reps_habit > 15` → cap at 15.

The same `round_reps_habit` is used for both rounds if the user chooses two rounds.

### 4.4 Habit rest

- If user performs 2 habit rounds:
  - Rest between rounds: **30–60 seconds** (user can proceed early by tapping “Next round”).[cite:12][cite:30]

### 4.5 Habit progression rule

At the end of each week:
  
  - Inputs:
  - `sessions_completed` (number of habit days).
- Average perceived effort (RPE) from user ratings (scale 1–10).

Progression:
  
  - If `sessions_completed >= 5` AND average RPE ≤ 7:
  - Increase `round_reps_habit` by **+1 rep** (next week).
- Ensure weekly volume increase ≤ ~10% (if exceeded, limit to +1).[cite:20][cite:12]
- Else if average RPE ≥ 8 OR `sessions_completed < 3`:
  - Keep `round_reps_habit` unchanged or decrease by 1 (safety-first behavior).

Habit track always uses **the same level variation** as the strength track, to reinforce the same movement pattern.[cite:30]

---
  
  ## 5. Strength/Endurance Track – 3 Days per Week
  
  ### 5.1 Goal and structure
  
  - Goal: increase push-up strength and endurance toward the user’s continuous-rep goal.
- Frequency: **3 sessions per week** on non-consecutive days (e.g., Mon/Wed/Fri).
- Rounds per session: **5 rounds** (5 sets).
- Rest between rounds:
  - Default: **120 seconds**.
- User-adjustable: 60–150 seconds.
- The program must remain within evidence-based inter-set rest ranges for beginners (roughly 60–120 s).[cite:12][cite:13][cite:3][cite:30]

### 5.2 Initial volume prescription (per level)

Using the level’s `max_reps`:
  
  1. Compute weekly training volume:
  - `weekly_total_reps = max_reps * 2`.[cite:3]

2. Split across sessions:
  - `per_session_total = weekly_total_reps / 3`.

3. Split across rounds:
  - `round_reps_strength = per_session_total / 5`.

4. Apply bounds:
  - Minimum per round = 3 reps.
- Maximum (initial phase) per round:
  - Levels 0–2 (wall, incline, knee): cap at 8–15 reps.
- Level 3 (full): cap at 15 reps initially; later allow up to 25–40 reps as endurance improves.[cite:12][cite:27][cite:3]

The app must round `round_reps_strength` to an integer within these bounds.

### 5.3 Round execution logic

For each strength session:
  
  - Session consists of 5 rounds:
  - Round i:
  - UI shows `round_reps_strength` inside a big circle.
- User performs that number of push-ups for the current level.
- User taps the circle to mark completion.
- App starts a rest timer for configured duration (default 120 s).
- After rest:
  - App increments round counter (e.g., from 2/5 to 3/5).
- Displays `round_reps_strength` again for the next round.

---
  
  ## 6. Strength Track Progression and Deload
  
  ### 6.1 Session-level progression rule
  
  For each user:
  
  - Collect per-session data:
  - Whether all 5 rounds were completed at prescribed reps.
- Perceived effort (RPE 1–10).

Progression:
  
  - If the user completes all 5 rounds at `round_reps_strength` for **two consecutive sessions** AND RPE ≤ 7:
  - Increase `round_reps_strength` by **+1 rep per round** at the next session.
- Ensure total weekly volume increase ≤ ~10–15%.[cite:20][cite:12]

- If the user fails more than one round OR RPE ≥ 9:
  - Keep `round_reps_strength` unchanged OR decrease by 1 for the following session.

### 6.2 Deload week

When `round_reps_strength` reaches the upper cap for the current phase:
  
  - For one week:
  - Keep `round_reps_strength` constant.
- Reduce rounds per session from 5 to **3 rounds**.
- After deload:
  - Resume 5 rounds with the same or slightly increased reps depending on RPE and completion.[cite:17][cite:12][cite:30]

### 6.3 Periodic max re-tests

Every **3–4 weeks**:
  
  - The app prompts a max-rep test for the current level.
- After test:
  - Recompute `weekly_total_reps` and `round_reps_strength` using the new `max_reps`.
- This keeps training tailored to current capacity and follows basic periodization principles.[cite:12][cite:17][cite:30]

---
  
  ## 7. Level-Specific Progression Rules
  
  All level transitions must be controlled by performance thresholds.

### Level 0 (Wall push-ups)

- Habit:
  - Daily 1 round with `round_reps_habit`.
- Strength:
  - 3 sessions/week, 5 rounds with `round_reps_strength`, each 3–10 reps.
- Progress to Level 1 (Incline) when:
  - User can perform **3 sets of 8 wall push-ups** in one session with good form and RPE ≤ 7.[cite:30]

### Level 1 (Incline push-ups)

- Habit:
  - Daily 1 round (`round_reps_habit` 3–12).
- Strength:
  - 3 sessions/week, 5 rounds, each 3–12 reps.
- Progress by gradually lowering the incline over time.
- Move to Level 2 (Knee) or Level 3 (Full) when:
  - User can perform **3 sets of 8–10 low-incline push-ups** comfortably AND
- A full push-up test shows ≥3–8 reps (threshold can be chosen in app settings).[cite:30]

### Level 2 (Knee push-ups)

- Habit:
  - Daily 1 round (`round_reps_habit` 3–12).
- Strength:
  - 3 sessions/week, 5 rounds, each 3–15 reps.
- Progress to Level 3 (Full) when:
  - User can perform **3 sets of 8–12 knee push-ups** with good form AND
- A full push-up max test shows ≥8 reps.[cite:30]

### Level 3 (Full push-ups)

- Habit:
  - Daily 1–2 rounds (`round_reps_habit` 5–15), never to failure.
- Strength:
  - 3 sessions/week, 5 rounds, initial caps 8–15 reps, extended caps up to 25–40 reps as endurance develops.[cite:12][cite:27][cite:3][cite:4]

High-endurance phase for goals like 100 continuous push-ups:
  
  - As the user approaches **5 rounds of 30–40 reps**, total session volume (~150–200 reps) may justify:
  - Adding a weekly **max-attempt session** (1 set AMRAP).
- Slightly reducing volume on other days (undulating periodization).[cite:3][cite:4][cite:10][cite:17][cite:12]

---
  
  ## 8. Safety, Form and Feedback
  
  Training logic must always prioritise safety and technique:
  
  - Form cues:
  - Neutral spine, no hip sag.
- Elbows approximately 45° from torso.
- Controlled tempo, full range of motion.[cite:3][cite:30]
- Pain rules:
  - If user reports pain in wrists, shoulders, or chest:
  - Suggest options: fists, push-up handles, higher inclines.
- Consider temporarily reducing reps or rounds.
- Feedback:
  - After each session:
  - Store completion (round-by-round).
- Store RPE (1–10).
- Use these data in progression and deload rules (see sections 6 and 7).[cite:32][cite:12]

---
  
  ## 9. Integration with UI (Big Circle and Timer)
  
  Training methodology must be mapped to UI as follows:
  
  - Each round:
  - Show `round_reps` (habit or strength) in a large central circle.
- User completes the specified reps and taps the circle.
- App starts the rest timer (default 120 s).
- After rest:
  - App shows the next round index (e.g., “Round 2 of 5”) and the same `round_reps` (or updated value if progression logic changes mid-session).
- End of session:
  - Mark session as complete.
- Update weekly metrics and progression according to rules defined above.
- Propose the next day’s habit and strength plan with any adjusted reps.

This specification describes *only* the training methodology and should be used by the AI app-builder to implement all logic around: level selection, habit sessions, strength sessions, reps per round, rest, progression, deload, and level transitions, in accordance with current scientific recommendations for beginner resistance training and push-up progressions.[cite:12][cite:18][cite:3][cite:30]
