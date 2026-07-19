// Quiet Ritual, warm-clay variant.
//
// Same design language as the Habit-Visualizer app — cream canvas, hairline
// borders, calm radii, no colored glow — but the sage primary is swapped for a
// terracotta so effort and intensity still read on a training app.
//
// Contrast: primary on background is 5.1:1 (light) and 6.3:1 (dark), so it is
// safe for body-size text, not just large headings.
const colors = {
  light: {
    text: "#3b3330",
    tint: "#a4542f",

    background: "#fbf9f2",
    foreground: "#3b3330",

    card: "#ffffff",
    cardForeground: "#3b3330",

    primary: "#a4542f",
    primaryForeground: "#fdfbf6",

    secondary: "#ebe5d6",
    secondaryForeground: "#4a423c",

    muted: "#eee9da",
    mutedForeground: "#847a70",

    accent: "#f4ece2",
    accentForeground: "#8a4526",

    destructive: "#a53f3f",
    destructiveForeground: "#ffffff",

    border: "#e8e0cd",
    input: "#e2d9c2",

    overlay: "rgba(59, 51, 48, 0.45)",
    success: "#5a8e6f",
    warning: "#96703a",

    // Session semantics. `habit` is the everyday training session, `rest` the
    // recovery/countdown state — deliberately cool so it reads as "not effort".
    habit: "#a4542f",
    strength: "#a53f3f",
    rest: "#4e7f7e",
    habitSoft: "#f4ece2",
    strengthSoft: "#f6e9e6",
    surface: "#ffffff",
  },

  dark: {
    text: "#ece5da",
    tint: "#d68a5f",

    background: "#1e1b19",
    foreground: "#ece5da",

    card: "#272321",
    cardForeground: "#ece5da",

    primary: "#d68a5f",
    primaryForeground: "#1a1310",

    secondary: "#332d29",
    secondaryForeground: "#d5cabd",

    muted: "#2c2724",
    mutedForeground: "#968b80",

    accent: "#352c26",
    accentForeground: "#e0a077",

    destructive: "#c86a6a",
    destructiveForeground: "#ffffff",

    border: "#3a332e",
    input: "#3f3833",

    overlay: "rgba(0, 0, 0, 0.55)",
    success: "#7eaf91",
    warning: "#c2a067",

    habit: "#d68a5f",
    strength: "#c86a6a",
    rest: "#7aa8a7",
    habitSoft: "#352c26",
    strengthSoft: "#3a2b2b",
    surface: "#272321",
  },

  radius: 12,
};

export default colors;
