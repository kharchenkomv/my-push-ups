# Research-Based Push-Up Progression Methodology

## Evidence Summary

Current resistance-training guidelines for healthy adults emphasize that strength gains primarily depend on performing multi-joint exercises through full range of motion, with submaximal to near-maximal intensity, at least two sessions per week, rather than on training to absolute failure or using aggressive loading progressions.[cite:12] The ACSM 2026 Position Stand on resistance training notes that voluntary strength improves reliably across a wide range of repetition schemes as long as total weekly volume and intensity are sufficient, and that no single set-structure (e.g., always to failure) is clearly superior for strength in general populations.[cite:12][cite:10]

Push-ups are a valid and sensitive proxy for upper-body strength and muscular fitness. Research on push-up tests administered remotely in adults showed medium correlations between standard push-ups and bench-press 1RM, and push-up performance increased significantly alongside maximal strength after a 6‑month strength program, supporting their use as a practical, field-based strength test.[cite:19] Additional work on the reliability of various push-up protocols (e.g., timed or AMRAP tests) indicates that push-up counts are reproducible between raters and across sessions when technique criteria are standardized, which is important for an app that periodically re-tests max push-ups.[cite:20][cite:30]

Biomechanical studies comparing standard (toe) push-ups with knee or other variants demonstrate that knee push-ups reduce mechanical loading while maintaining similar movement patterns, making leverage changes a safe way to manage intensity without resorting to exhaustive sets.[cite:28] This supports the idea that pure strength progression can be pursued either by increasing reps at a given variation or by transitioning to more demanding leverage positions over time, while keeping daily sets submaximal.

Regarding rest intervals and fatigue, NSCA-aligned reviews emphasize that when training for strength, longer rests (often 2–3 minutes or more between hard sets) help maintain load and bar speed across sets, while short-rest, high-fatigue approaches are more strongly associated with hypertrophy or endurance adaptations.[cite:9][cite:6] The ACSM Position Stand likewise concludes that training to momentary failure is not required for strength gains and that submaximal, well-recovered sets can be equally effective as long as total volume is adequate.[cite:12] For daily training, this suggests a structure that emphasizes technique, controlled fatigue, and small, regular volume increases rather than daily all-out efforts.

Evidence on overreaching and overtraining in strength sports highlights that chronic high-fatigue training without recovery management can lead to performance plateaus, increased injury risk, and psychological burnout, whereas planned submaximal phases, short deloads, and undulating intensity help maintain long-term progress.[cite:23] For a daily 5‑round push-up plan with no full rest days, this strongly supports embedding lighter, more technical days and using conservative volume progressions, even if calendar rest days are not allowed.

## Core Training Principles

### Intensity per round

Given that the user’s primary metric is max consecutive push-ups but the primary goal is strength, each round should be prescribed as a percentage of the current max but remain clearly submaximal. Based on ACSM and NSCA guidance, a practical intensity band for strength-oriented push-up sets is roughly 40–70% of max reps per set.[cite:12][cite:9] For example, if a user’s max is 20, most working rounds should land around 8–14 reps; if max is 10, rounds of 4–7 reps are appropriate. This avoids the high fatigue associated with near-maximal sets while still providing enough tension and volume to drive strength adaptations.

Most rounds should cluster around the middle of this band (≈50–60% of max), with occasional slightly higher sets when the user feels fresh and technique is solid. In practice, this means the app computes round targets like 60%, 60%, 55%, 55%, 50% of max for the five daily rounds, then adjusts by ±1 rep based on recent performance, perceived effort, and pain/technique flags.

### Strength-oriented vs endurance-oriented programming

Endurance-oriented push-up plans typically emphasize higher repetitions per set, shorter rest intervals, and frequent or daily maximal-effort sets, aiming to increase time under tension and metabolic stress.[cite:9][cite:6] In contrast, a strength-oriented plan should:

- Keep most sets comfortably submaximal, avoiding grinding fatigue.
- Allow longer rest between rounds (e.g., 90–120 seconds or more) to preserve repetition quality and speed.
- Focus on tight technique (neutral spine, controlled tempo, full range of motion) even if that reduces daily total reps.[cite:28]

Because the user performs no other pressing exercises, the push-up plan must serve both as strength practice and stimulus. To maintain a strength emphasis, the app should prioritize:

- **Relative intensity**: Round targets computed as a fraction of max rather than arbitrary high rep counts.
- **Volume control**: Daily total volume increased slowly (≈1–2 reps per day on average) to minimize overuse risk.
- **Technique gating**: Users are instructed to stop sets when form deteriorates, not to chase the last possible rep.

### Distribution across 5 rounds

Evenly splitting total reps across 5 rounds is simple, but a slightly front-loaded, wave-like structure better reflects strength practice. For example, with max = 20 and a daily total ≈60%×2 + 55%×2 + 50%×1 of max, the app might prescribe 12, 12, 11, 11, 10 reps. This pattern:

- Uses the first rounds when the user is freshest to practice crisp, higher-quality sets.
- Tapers slightly in later rounds to account for accumulating fatigue.
- Keeps the last round as a “technical anchor” where the user can focus on perfect form at slightly lower reps.

As max improves and daily volume creeps up, the app can introduce mild undulation across days (e.g., slightly lower volume days every 7th day) while keeping the same 5‑round shape. This is conceptually similar to undulating periodization but expressed through daily push-up volumes rather than load changes.[cite:23]

### Progression pattern

Given the constraint that the user trains every calendar day with 5 rounds, a **stepwise micro-progression** is preferable to aggressive linear loading. The app should increase total daily reps by about 1–2 reps per day on average by:

- Adding 1 rep to one round on most days (e.g., rotating extra reps across rounds).
- Holding volume constant on lighter “technical emphasis” days.

A weekly or biweekly max re-test then updates `max_pushups`, which recalibrates percentage-based round targets.[cite:19] This keeps the program aligned with the user’s actual capacity and prevents long-term drift.

### Fatigue management without rest days

Although true rest days are ideal, the constraint here is daily training. To honor evidence on recovery while meeting this constraint, the app can implement:

- **Technical days**: Once every 7–14 days, prescribe lower total reps (e.g., ~80–90% of the previous day’s volume) and keep all sets at the lower end of the intensity band (~40–50% of max). These days emphasize tempo control, range of motion, and pain-free movement.
- **Micro-deloads**: If a user reports high perceived exertion (RPE ≥8–9) or recurrent pain, reduce prescribed reps per round by 1–2 for 2–3 days while keeping the daily 5‑round structure intact.

These strategies align with overreaching/overtraining literature, which recommends short reductions in training stress rather than only long breaks, particularly when program constraints limit formal rest days.[cite:23]

## Proposed Algorithm

### Inputs

- `max_pushups`: most recent tested max consecutive push-ups (technical limit, not forced failure).
- `day_number`: integer day index in the plan (starting from 1).
- Optional flags:
  - `recovery_status` (e.g., "good", "tired", "very tired").
  - `technique_quality` (e.g., "good", "borderline", "poor").
  - `pain_flag` (true/false for wrists, shoulders, elbows).
  - `training_age` (e.g., weeks of consistent training).

### Step 1: Base percentages per round

Define base intensity percentages for the five daily rounds, oriented toward strength:

- Round 1: 0.60 × `max_pushups`.
- Round 2: 0.60 × `max_pushups`.
- Round 3: 0.55 × `max_pushups`.
- Round 4: 0.55 × `max_pushups`.
- Round 5: 0.50 × `max_pushups`.

This keeps all rounds clearly submaximal while slightly tapering with fatigue.

### Step 2: Convert to integer reps with bounds

For each round i (1–5):

1. Compute `base_reps_i = floor(percentage_i * max_pushups)`.
2. Apply a minimum of 3 reps: if `base_reps_i < 3`, set `base_reps_i = 3` (unless max_pushups itself is <3, in which case use `max_pushups` for all rounds).
3. Apply a maximum of 0.70 × max: if `base_reps_i > floor(0.70 * max_pushups)`, cap at `floor(0.70 * max_pushups)`.

This ensures each round remains within a strength-appropriate rep band.[cite:12]

### Step 3: Microcycle structure and daily progression

Use a 7‑day microcycle to manage progression and fatigue while still training daily:

- Days 1–5: progressive days.
- Day 6: hold day (no increase in total reps).
- Day 7: technical/light day with lower percentages.

Define `daily_increment_pattern` to add about 1–2 total reps on days 1–5:

- Day 1: no extra reps beyond base.
- Day 2: add +1 rep to Round 5.
- Day 3: add +1 rep to Round 1.
- Day 4: add +1 rep to Round 3.
- Day 5: add +1 rep to Round 2.

On Day 6:

- Keep all rounds at Day‑5 values (hold volume).

On Day 7 (technical day):

- Use lower percentages (e.g., 50%, 50%, 45%, 45%, 40% of `max_pushups`) and no daily increment.

This pattern yields an average increase close to 1–2 reps per day across the full week, because Days 1–5 add a total of +4 reps while Days 6–7 hold or slightly reduce volume.

### Step 4: Adjustments for recovery, technique, and pain

Before finalizing daily targets, adjust for user status:

- If `recovery_status` is "very tired" or `technique_quality` is "poor" or `pain_flag` is true:
  - Subtract 1–2 reps from every round, but respect the 3‑rep minimum.
  - Mark the day as a safety-adjusted day; do not progress volume the next day unless the user reports improvement.

- If `recovery_status` is "good" and `technique_quality` is "good" for 3 consecutive days with all rounds completed:
  - Allow an extra +1 daily increment on the next progressive day (e.g., add +1 to both Round 1 and Round 5 instead of just one round).

These adjustments implement basic autoregulation within the constraints of daily training.

### Step 5: Skipped days logic

If the user skips one or more days:

- Do **not** advance `day_number` in the microcycle.
- On resumption, the app uses the last successfully completed day’s round targets and repeats that day.

This prevents compressed volume ("catching up") and maintains a smooth progression.[cite:23]

### Step 6: Periodic max re-tests

Every 7–14 days (configurable), the app prompts a max push-up test:

- The user performs 1 set to their technical limit (stop when form breaks, not at absolute failure).[cite:12]
- The new `max_pushups` replaces the old value.
- The app recomputes base percentages and rounds using Steps 1–4.

This keeps the intensity prescription anchored to current capacity and follows basic periodization principles.[cite:12][cite:19]

### Outputs

For a given `max_pushups`, `day_number`, and status flags, the algorithm returns:

- `round_reps[1..5]`: target reps for each of the 5 daily rounds.
- `total_daily_reps`: sum of the five rounds.
- `is_technical_day`: boolean flag.
- `expected_trend`: qualitative expectation (e.g., "maintenance", "small progression") based on microcycle position.

Expected progression in max push-ups over 4–8 weeks is approximately:

- Beginners (max ≤15): 10–25% improvement, assuming adherence and good recovery.[cite:12]
- Intermediates (max 16–30): 5–15% improvement.

These ranges reflect typical strength-training outcomes rather than guarantees.[cite:12]

## Example 4–6 Week Plan

Below are simplified 3‑week examples for two users, illustrating 5 rounds per day, small daily volume increases, and weekly re-tests.

### Beginner example (max_pushups = 10)

Initial base compute (Day 1, no adjustments):

- Round 1: floor(0.60 × 10) = 6.
- Round 2: 6.
- Round 3: floor(0.55 × 10) = 5.
- Round 4: 5.
- Round 5: floor(0.50 × 10) = 5.

We slightly taper Round 5 to 4 on Day 1 for technical emphasis (first day safety), giving 6, 6, 5, 5, 4 = 26 total reps.

**Week 1 (Days 1–7)**

- Day 1: 6, 6, 5, 5, 4 (26 total).
- Day 2 (+1 to R5): 6, 6, 5, 5, 5 (27).
- Day 3 (+1 to R1): 7, 6, 5, 5, 5 (28).
- Day 4 (+1 to R2): 7, 7, 5, 5, 5 (29).
- Day 5 (+1 to R3): 7, 7, 6, 5, 5 (30).
- Day 6 (hold): 7, 7, 6, 5, 5 (30).
- Day 7 (technical day, lower percentages): 5, 5, 4, 4, 4 (22).

At the end of Day 7, the user re-tests max_pushups. Suppose the new max is 11. The app recalculates Week‑2 base reps from 11.

**Week 2 (Days 8–14, new max = 11)**

Base percentages yield approximately: R1=6, R2=6, R3=6, R4=6, R5=5.

- Day 8 (base only): 6, 6, 6, 6, 5 (29).
- Day 9 (+1 R5): 6, 6, 6, 6, 6 (30).
- Day 10 (+1 R1): 7, 6, 6, 6, 6 (31).
- Day 11 (+1 R3): 7, 6, 7, 6, 6 (32).
- Day 12 (+1 R2): 7, 7, 7, 6, 6 (33).
- Day 13 (hold): 7, 7, 7, 6, 6 (33).
- Day 14 (technical): 5, 5, 5, 5, 4 (24).

Re-test again; suppose max increases to 12.

**Week 3 (Days 15–21, new max = 12)**

Base: R1=7, R2=7, R3=6, R4=6, R5=6.

- Day 15: 7, 7, 6, 6, 6 (32).
- Day 16 (+1 R5): 7, 7, 6, 6, 7 (33).
- Day 17 (+1 R1): 8, 7, 6, 6, 7 (34).
- Day 18 (+1 R3): 8, 7, 7, 6, 7 (35).
- Day 19 (+1 R2): 8, 8, 7, 6, 7 (36).
- Day 20 (hold): 8, 8, 7, 6, 7 (36).
- Day 21 (technical): 6, 6, 5, 5, 5 (27).

Across these three weeks, the plan increases total daily reps modestly while maintaining submaximal rounds and inserting lighter technical days.

**Skipped day scenario**: If the user skips Day 11, they resume on their next training day with Day‑11 targets rather than Day‑12. Only after successfully completing Day‑11 does the app move the microcycle forward.

### Intermediate example (max_pushups = 25)

Initial base compute (Day 1):

- R1: floor(0.60 × 25) = 15.
- R2: 15.
- R3: floor(0.55 × 25) = 13.
- R4: 13.
- R5: floor(0.50 × 25) = 12.

Day 1 prescription: 15, 15, 13, 13, 12 (68 total).

**Week 1 (Days 1–7)**

- Day 1: 15, 15, 13, 13, 12 (68).
- Day 2 (+1 R5): 15, 15, 13, 13, 13 (69).
- Day 3 (+1 R1): 16, 15, 13, 13, 13 (70).
- Day 4 (+1 R2): 16, 16, 13, 13, 13 (71).
- Day 5 (+1 R3): 16, 16, 14, 13, 13 (72).
- Day 6 (hold): 16, 16, 14, 13, 13 (72).
- Day 7 (technical): 13, 13, 11, 11, 10 (58).

Assume a re-test at Day 7 gives max = 27.

**Week 2 (Days 8–14, new max = 27)**

Base: R1=16, R2=16, R3=14, R4=14, R5=13.

- Day 8: 16, 16, 14, 14, 13 (73).
- Day 9 (+1 R5): 16, 16, 14, 14, 14 (74).
- Day 10 (+1 R1): 17, 16, 14, 14, 14 (75).
- Day 11 (+1 R3): 17, 16, 15, 14, 14 (76).
- Day 12 (+1 R2): 17, 17, 15, 14, 14 (77).
- Day 13 (hold): 17, 17, 15, 14, 14 (77).
- Day 14 (technical): 14, 14, 12, 12, 11 (63).

Re-test max; suppose it rises to 29.

**Week 3 (Days 15–21, new max = 29)**

Base: R1=17, R2=17, R3=15, R4=15, R5=14.

- Day 15: 17, 17, 15, 15, 14 (78).
- Day 16 (+1 R5): 17, 17, 15, 15, 15 (79).
- Day 17 (+1 R1): 18, 17, 15, 15, 15 (80).
- Day 18 (+1 R3): 18, 17, 16, 15, 15 (81).
- Day 19 (+1 R2): 18, 18, 16, 15, 15 (82).
- Day 20 (hold): 18, 18, 16, 15, 15 (82).
- Day 21 (technical): 15, 15, 13, 13, 12 (68).

Across these weeks, daily total reps increase steadily but safely, while sets remain clearly submaximal and weekly technical days support recovery.

**Skipped day scenario**: As with the beginner example, any skipped day is repeated; the plan does not advance until each day’s prescription has been completed.

## Safety and Adjustments

### Safety of daily push-up training

Daily push-up training without formal rest days is acceptable for many healthy adults if intensity and volume are modest and progression is conservative.[cite:12] The main limitations are:

- Increased risk of overuse injuries at the wrists, elbows, and shoulders.
- Potential technique degradation under cumulative fatigue.
- Psychological fatigue or boredom.

The algorithm mitigates these risks by keeping sets submaximal, capping daily volume increases, and inserting weekly technical days with lower intensity.

### Signs of overuse or inadequate recovery

Users should watch for:

- Persistent joint pain (especially shoulders, elbows, wrists) that does not resolve after lighter days.
- Marked decline in performance (unable to complete prescribed reps for several days).
- Sleep disruption, irritability, or lack of motivation to train.

If these signs appear, the app should automatically:

- Reduce per-round reps by 2–3 for 3–5 days.
- Maintain the daily 5‑round structure but treat all days in that window as technical days.
- Prompt the user to consult a professional if pain persists.[cite:12][cite:23]

### Modifications for different fitness levels and limitations

- **Older or deconditioned users**: Use lower initial percentages (e.g., 50%, 50%, 45%, 45%, 40%) and slower progression (e.g., +1 total rep every other day). Consider higher-incline variations to reduce load, as supported by push-up variant research.[cite:28]
- **Joint limitations**: Suggest modifications such as fists, push-up handles, or elevated surfaces (e.g., counters, benches) to reduce wrist extension and shoulder loading.[cite:28]

### Adjustment rules

- If the user cannot complete a prescribed round:
  - Mark the round as incomplete.
  - Next day, reduce all round targets by 1 rep and repeat the same day’s pattern.
  - Only resume normal progression after two consecutive days of full completion with RPE ≤7.

- If the plan feels too easy (RPE ≤5 for all rounds over 3 days):
  - Add +1 rep to one extra round per progressive day (up to two rounds per day) while still obeying the 0.70 × max cap.

- If pain or technique breakdown occurs:
  - Immediately stop the set.
  - For that day and the next 2–3 days, treat every day as a technical day with reduced percentages and total reps.
  - Advise seeking medical or professional input if pain persists.

- If the user stops for a day or more:
  - On resumption, repeat the last successfully completed day’s prescription.
  - Do not attempt to "catch up" missed volume.

## References

- American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults, 2026.[cite:12]
- ACSM science spotlight on updated resistance training guidelines, 2026.[cite:10]
- Willardson JM. Brief review of rest interval length and training goals in resistance training.[cite:9]
- NSCA educational article on manipulating rest intervals to maximize strength training.[cite:6]
- Chalmers et al. Validity and reliability of remotely administered push-up tests for maximal upper-body strength.[cite:19]
- Studies on push-up test reliability and objectivity.[cite:20][cite:30]
- Dynamic and electromyographical analysis of push-up variants, showing altered loading with knee push-ups and other variations.[cite:28]
- Overreaching and overtraining in strength sports and resistance training: a review.[cite:23]
