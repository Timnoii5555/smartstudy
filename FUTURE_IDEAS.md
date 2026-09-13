# Future ideas

Things considered while working through the study-planner/revision-app spec
but deliberately not built, per the "no feature creep — write it here
instead" rule. Each entry says what it is and why it was left out, so a
later pass can pick any of these up with full context.

## Private co-study rooms — a scoped-safe version shipped instead

The spec describes invite-link-only private rooms (max 12 members, nicknames
+ binary studying/not-studying status, a creator who can remove members,
per-member report/leave, 7-day link expiry with regeneration) on top of the
public "how many people are focusing" count.

What shipped instead (`js/groups.js` + `js/groupsUI.js`, requested directly
as "study groups" alongside a reference app's fuller version): named,
shareable rooms — a join code or a public-groups browse list, a daily goal,
a live "studying now" headcount — but every member stays exactly as
anonymous as the public flight-presence count already is. No nicknames, no
member list, no per-member anything, no creator role, no camera ("Cam
Study" in that reference — a live-video feature not built at all, full
stop: recording/streaming video of what could be minors studying alone at
home is a real child-safety risk, not a convenience trade-off), no
ranking/leaderboard (this app's own non-negotiable rule).

Why stop there: this app's own rule is that any room UI needs a
report/block flow *unless* it exposes zero identifying info. Anonymous
groups (like the public count before them) need none of that review
weight. The moment a nickname or a visible member list gets added, that
changes — a member list, per-member report/leave, a creator role, and the
report/block flow itself is still real, separate future work, and needs to
build the moderation half alongside it, not skip that part the way it
would be tempting to under time pressure.

## Sub-25-minute scheduling blocks

The spec asks for each day's reading to be broken into discrete 15-25 minute
blocks. This app schedules whole *topics* instead (each with its own
`estMinutes`, typically 90-200 minutes) — splitting a topic into
sub-blocks would touch the reading plan, the dashboard checklist, the
"read ahead" flow, and the "not up for it today" redistribution all at
once, since topic ids are the unit those all key off of today.

The pacing work that *did* ship (`js/planner.js`'s spread-across-the-window
logic, rest days, the reserved pre-exam review day) works at the
topic-granularity level instead: it spaces topics across the available
days rather than exactly hitting "60% of blocks in the first two-thirds",
which is a reasonable approximation but not the literal spec.

## A real test runner

`js/srs.js`'s SM-2 scheduler is covered by `test-srs.html` — a static page
opened directly in a browser that runs plain assertions and prints
pass/fail — instead of Vitest. This project has no `package.json`, no
build step, and is explicitly designed to run straight from disk or a
static host (see `js/utils.js`'s file header); adding Vitest means adding
Node + npm + a build step, which is a bigger architectural change than "add
one dependency" for a codebase built to need none of that. If this project
ever does adopt real build tooling, porting `test-srs.html`'s assertions
into actual Vitest specs is close to a copy-paste job.

## Ambient full-screen focus mode — now shipped

Phase 1 listed this as explicitly optional ("time only, plus a small exit
affordance"), originally skipped under "when unsure whether to add
something, don't." It shipped later in a themed form: screen 6's flight
map can go full-screen (`js/focus.js`'s enterImmersive/exitImmersive),
showing the timer/controls over the map with a minimize button, entered
manually or automatically right after the boarding-pass check-in ritual.

## Per-aircraft chat rooms — declined

Requested directly: choosing an aircraft/airline with its own chat room for
passengers to talk during a session. Not built — it's exactly the category
the original pasted spec's non-negotiable rules rule out ("no chat/DMs...
any room UI needs report/block unless it exposes zero identifying info"),
which the leaderboard/points removal earlier in this project followed
literally. Free-text chat between strangers on a study app aimed at TCAS
exam takers (typically minors) needs real moderation infrastructure
(report/block, rate limiting, abuse handling) that doesn't exist here, and
building it unmoderated would be a real child-safety regression, not a
design preference to weigh. The per-flight presence this app already has
(a passenger count, lit cabin windows, and now real seat occupancy in the
seat picker) stays the ceiling for this feature: real signal that other
people are there, with zero identifying info and nothing to report or
block. If real-time contact between learners is ever wanted, matched preset
reactions (no free text) would be the smallest step that doesn't cross back
into the same territory.

## Full per-session focus log — partially reconsidered

"Best time of day" in `js/stats.js` still reads from a running 4-bucket
tally (`state.focus.timeOfDayMinutes`) rather than a timestamped log of
every individual session, for the reason originally written here: a real
log would let it account for recency or support a proper histogram, but
the bucket tally can't, it only ever answers "which bucket has the most
cumulative minutes, ever."

A bounded version of the log this entry used to argue against did end up
shipping, though, once "Mine"'s flight log (`js/pilotClub.js`) gave it a
concrete reason to exist: `state.focus.flightLog` (`js/focus.js`'s
logFlight()) keeps the most recent 20 completed-or-partial focus sessions,
capped with the same `.slice(-20)` pattern `flashcards.js`'s `reviewLog`
already used — proof the "never needing to bound or prune a growing array"
concern was solvable by just bounding it, not only by avoiding logging
altogether. Reusing this same log for "best time of day" (accounting for
recency, or a real histogram) is still a reasonable follow-up, since the
data's real timestamps would need capturing anyway if the cap were raised
or the log's purpose broadened past what 20 entries can support.

## A full contrast/touch-target audit

Two real issues turned up while wiring in the Paper/Night themes and got
fixed on the spot: `.icon-btn`/`.modal-close` were both under the 44px
touch-target minimum everywhere they're used, and `.btn--pill-white`'s text
color dropped to roughly 2.6:1 contrast in the Dark theme. Those are fixed.
A line-by-line pass over the rest of `styles/components.css` and
`styles/screens.css` across all four themes (light/dark/paper/night),
including hover/disabled/error states specifically, has not been done.

## Night theme: progressive screen-dimming during long sessions

The Night gimmick's brief (Phase 8) named this alongside its stars/
constellations mechanic and its shooting stars (the latter did ship —
see `js/gimmicks/night.js`). It was left out of the same pass because it
needed a new settings surface (a toggle to opt out) this session wasn't
confident enough of the exact intended behavior to add without risking
clutter: is it the whole screen behind the timer that dims, or just the
gimmick's own scene card; does it reset every round or accumulate across
a study session; is a toggle even the right control, versus just always
being subtle enough not to need one? Worth building once these are
pinned down, ideally starting from a mock of the exact dimming curve
wanted rather than guessing at one from the brief text alone.

## Reading-plan regeneration from Settings

Editing the exam date or daily-goal hours from the Settings modal (as
opposed to the onboarding flow on screen 2) updates those values but does
not regenerate `state.plan.readingPlan` to match — the existing plan stays
as originally generated until the learner goes through screen 2 again.
Auto-regenerating on every Settings edit was left out to avoid silently
reshuffling a plan the learner is mid-way through without them asking for
it; a "regenerate my plan" button in Settings that does it explicitly, on
demand, would be a reasonable middle ground.
