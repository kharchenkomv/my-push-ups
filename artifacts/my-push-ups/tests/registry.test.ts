import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_EXERCISE_ID,
  EXERCISES,
  EXERCISE_IDS,
  getExercise,
  isExerciseId,
} from "../lib/exercises";
import { pushups } from "../lib/exercises/pushups";
import { planForDay } from "../lib/exercises/pushups/engine";
import { PAIN_FLAGS } from "../lib/types";

// ---------------------------------------------------------------------------
// Invariants every registered exercise must satisfy. These run over the whole
// registry, so the day a plank descriptor is added it is held to the same
// contract without anyone writing a new test.
// ---------------------------------------------------------------------------

describe("exercise registry", () => {
  it("registers at least the default exercise", () => {
    assert.ok(EXERCISE_IDS.length >= 1);
    assert.ok(EXERCISE_IDS.includes(DEFAULT_EXERCISE_ID));
  });

  it("keys match each descriptor's own id", () => {
    for (const id of EXERCISE_IDS) {
      assert.equal(EXERCISES[id].id, id);
    }
  });

  it("getExercise falls back to the default for junk input", () => {
    assert.equal(getExercise("pushups").id, "pushups");
    assert.equal(getExercise("plank").id, DEFAULT_EXERCISE_ID);
    assert.equal(getExercise(undefined).id, DEFAULT_EXERCISE_ID);
    assert.equal(getExercise(null).id, DEFAULT_EXERCISE_ID);
    assert.equal(getExercise("").id, DEFAULT_EXERCISE_ID);
  });

  it("isExerciseId is exact", () => {
    assert.equal(isExerciseId("pushups"), true);
    assert.equal(isExerciseId("PUSHUPS"), false);
    assert.equal(isExerciseId(7), false);
  });

  it("gradient ids are unique across the registry", () => {
    const ids = EXERCISE_IDS.map((id) => EXERCISES[id].format.gradientId);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("exercise descriptor contract", () => {
  for (const id of EXERCISE_IDS) {
    const def = EXERCISES[id];

    describe(id, () => {
      it("plans a full cycle, always with roundsPerSession rounds", () => {
        // Two full cycles, so wrap-around is covered too.
        for (let day = 1; day <= def.engine.cycleDays * 2; day++) {
          const plan = def.engine.planForDay(20, day);
          assert.equal(plan.rounds.length, def.engine.roundsPerSession);
          assert.equal(plan.dayNumber, day);
          assert.ok(plan.microPos >= 1 && plan.microPos <= def.engine.cycleDays);
          assert.equal(
            plan.total,
            plan.rounds.reduce((a, b) => a + b, 0),
          );
          assert.ok(plan.rounds.every((r) => Number.isInteger(r) && r >= 0));
        }
      });

      it("describes every day in the cycle", () => {
        for (let day = 1; day <= def.engine.cycleDays; day++) {
          const meta = def.engine.dayMeta(def.engine.planForDay(20, day));
          assert.ok(meta.label.length > 0, `day ${day} label`);
          assert.ok(meta.hint.length > 0, `day ${day} hint`);
          assert.ok(meta.icon.length > 0, `day ${day} icon`);
          assert.ok(["primary", "rest", "warning", "success"].includes(meta.tone));
        }
      });

      it("advanceDayNumber moves forward by exactly one", () => {
        assert.equal(def.engine.advanceDayNumber(1), 2);
        assert.equal(
          def.engine.advanceDayNumber(def.engine.cycleDays),
          def.engine.cycleDays + 1,
        );
      });

      it("format round-trips a value through parse(format(v))", () => {
        for (const v of [1, 5, 12, 45, 90, 137]) {
          assert.equal(
            def.format.parseValue(def.format.formatValue(v)),
            v,
            `round-trip ${v}`,
          );
        }
      });

      it("maskInput never exceeds inputMaxLength", () => {
        const masked = def.format.maskInput("9".repeat(20));
        assert.ok(masked.length <= def.format.inputMaxLength);
      });

      it("axisCeil is monotonic and never below its input", () => {
        let prev = 0;
        for (const v of [1, 5, 9, 20, 41, 68, 150]) {
          const c = def.format.axisCeil(v);
          assert.ok(c >= v, `ceil(${v}) = ${c} must not be below ${v}`);
          assert.ok(c >= prev, "monotonic");
          prev = c;
        }
      });

      it("milestones are ascending and positive", () => {
        assert.ok(def.milestones.length > 0);
        for (let i = 1; i < def.milestones.length; i++) {
          assert.ok(
            def.milestones[i]! > def.milestones[i - 1]!,
            "milestones must strictly ascend",
          );
        }
        assert.ok(def.milestones.every((m) => m > 0));
      });

      it("defaults are selectable from their own option lists", () => {
        assert.ok(def.restOptions.includes(def.defaultRestSeconds));
        assert.ok(def.defaultRestSeconds <= def.maxRestSeconds);
      });

      it("pain options are non-empty and use known flags", () => {
        assert.ok(def.painOptions.length > 0);
        for (const p of def.painOptions) {
          assert.ok(
            (PAIN_FLAGS as readonly string[]).includes(p.key),
            `unknown pain flag ${p.key}`,
          );
          assert.ok(p.label.length > 0);
        }
      });

      it("every copy string is present and non-empty", () => {
        const c = def.copy;
        const statics = [
          c.name,
          c.nameLower,
          c.chartTitle,
          c.maxTestTitle,
          c.maxTestNavTitle,
          c.maxTestShort,
          c.maxTestIntro,
          c.maxTestRetestIntro,
          c.maxTestHistoryLabel,
          c.progressNote,
          c.submaximalNote,
          c.maxCardNote,
          c.safetyNote,
          c.painNote,
          c.painBanner,
          c.restHint,
          c.roundHint,
          c.reminder.title,
          c.reminder.body,
        ];
        for (const s of statics) assert.ok(s && s.length > 0);

        // The interpolating ones must actually use their argument.
        assert.ok(c.heroMax("42").includes("42"));
        assert.ok(c.planMax("42").includes("42"));
        assert.ok(c.milestoneLabel(42).includes("42"));
        assert.ok(c.circleA11y(2, 42).includes("42"));
      });
    });
  }
});

describe("push-up descriptor wiring", () => {
  it("delegates to the exact engine function the engine tests cover", () => {
    // Guards against the descriptor quietly drifting to a reimplementation.
    assert.equal(pushups.engine.planForDay, planForDay);
  });

  it("reproduces the intermediate worked example through the descriptor", () => {
    assert.deepEqual(
      pushups.engine.planForDay(25, 5).rounds,
      [16, 16, 14, 13, 13],
    );
  });

  it("labels day 7 as the light day", () => {
    const meta = pushups.engine.dayMeta(pushups.engine.planForDay(25, 7));
    assert.equal(meta.label, "Light");
    assert.equal(meta.tone, "rest");
  });
});
