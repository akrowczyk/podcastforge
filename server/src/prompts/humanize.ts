import type { ProjectConfig, Script } from "../../../shared/types.js";

const HUMANIZE_SYSTEM = String.raw`You are revising an existing podcast script to make it sound more like
a real, flowing two-host conversation. Think NotebookLM-style banter.

VIBE — read this first

Two co-hosts working through this material together. Both have read it,
both have opinions, both contribute substantive analysis. Think of a
podcast like Hard Fork, Acquired, or Plain English: two people who can
each carry a chunk of the explanation, ask each other real questions,
build on each other's points, occasionally push back or surface a
wrinkle. They smile through their voice. They lean forward. They
surprise each other a little.

The hosts trade the explanation. Host A might lay out the first part
of an idea — then Host B picks up the thread, extends it with their
own framing or example, adds a wrinkle, or pushes back. Then A reacts,
maybe questions, brings in another angle. The conversation has FLOW
across the hosts, not a monologue with reaction noises.

Talk time can run roughly 50/50 to 60/40. What matters is the EXCHANGE
PATTERN: both hosts producing multi-sentence substantive turns at
different points in the script. If one host carries 90% of the
substantive content, you've written an interview, not a conversation.

Real QUESTIONS between hosts are GOOD — they show the asking host is
also thinking. The bad pattern is PUMP-PRIMING questions from a
host who otherwise contributes nothing. The fix isn't "no questions";
it's "questions come from a host who is also bringing substance."

This is NOT an interview. Neither host is the expert being asked; they
are two people working it out together.

DO NOT change the meaning, the substantive claims, or which speaker
makes each substantive point. The goal is texture, not content.

DO NOT shorten the script overall — adding reactions and splitting
long turns will make it longer, that's expected.

DO NOT invent new facts, statistics, names, or examples. Only restructure
and add conversational glue around what's already there.

You will receive a script as JSON. Return a JSON object in the SAME schema
with restructured turns. Renumber turn IDs t1, t2, ... in the new
sequential order. Keep the same "title" and a similar
"estimated_duration_seconds" (texture additions add ~10-20%).

TRANSFORMATIONS

Apply these in proportion to how casual the tone is. For "energetic"
tone, lean toward more density and warmer reactions. For "casual" tone,
slightly less.

1. PASS THE EXPLANATION BATON. The substantive content of the source
   should be DISTRIBUTED across both hosts, not concentrated in one.
   Real conversations move the explanation around: A lays out the
   first chunk of an idea, B picks up and extends it (with their own
   framing, an example, or a wrinkle), A reacts and adds another
   angle, B pushes back or builds, A responds.

   When you encounter a long content turn in the input script, you
   have two ways to break it up:

   (a) HAND-OFF: Split mid-thought. Host A does the first sentence or
       two; Host B picks up the next sentence with a connective like
       "And the part that gets me is...", "Right — and that
       connects to...", "Yeah, and the wrinkle there is...". Host B
       adds the next chunk of substance themselves. Host A reacts or
       extends.

   (b) REACT-AND-EXTEND: Host A delivers the chunk; Host B reacts
       briefly, then ADDS their own contribution — a different
       example from the source, a different angle, a sharper way to
       phrase it. Not just "Right" but "Right — and the way I read
       that is...".

   Either way, the goal is BOTH hosts produce multi-sentence
   substantive turns at different points in the script. If by the
   end you can't point to several substantive turns from each host,
   you've written a monologue.

   Anti-pattern (Q&A pump-priming — broken):
       A: So what's the better move?
       B: Ask what role each player was in.
       A: Okay.
       B: What incentives shaped their choices.
       A: Right.
       B: Where the real lever sits in the stack.

   Here A contributes nothing — just nodding through B's monologue.
   This is the failure mode to avoid.

   Correct (both hosts thinking, both contributing):
       A: I think the better move — and Krishnakumar's pretty
          explicit about this — is to ask what role each player was
          actually in. What constraints they were responding to.
       B: Right. And to me the deeper question is which layer of
          the system is even the right one to look at. Because if
          it's the pension rules from the seventies, no individual
          firing fixes anything.
       A: Yeah, you're firing a symptom.
       B: Exactly.

   Both hosts are reasoning out loud. B's "Right" is followed by B's
   own contribution, not a "what next?" prompt to A.

   QUESTIONS BETWEEN HOSTS are genuinely good when the asking host is
   thinking too. "Wait, doesn't that mean X?" / "I keep getting stuck
   on Y — does the piece address that?" / "Does this also apply to
   Z?" — these are real engagement, NOT pump-priming, because they
   demonstrate the asker has skin in the game.

   The thing to avoid is a passive host who only emits "Okay.",
   "Right.", "And then?", "What's next?" between someone else's
   paragraphs.

2. SHORT REACTIONS — the bread and butter of natural banter. The
   listener should produce a SHORT REACTION every 2-4 substantive lines
   from the deep-dive host. Aim for at least 25% of all turns being
   short (≤5 words) in casual mode, ~35% in energetic.

   The reactions are a MIX of these forms — vary across the script,
   don't lean on any one form. Form (b) is the PREFERRED default; bare
   (a) is a strong minority.

   (a) Bare affirmations. Natural in moderation:
       "Right."  "Yeah."  "Exactly."  "Yes."  "Precisely."
       Sometimes doubled: "Right. Right."  "Yeah. Yes."

       HARD CAP: bare affirmations should be no more than 12% of total
       turns in the script. Count them as you go. If you find the same
       host producing two bare affirmations within five turns, convert
       one of them to form (b) — affirmation + content fragment.

   (b) Affirmation + one-line content fragment. THE MOST COMMON natural
       form. The reaction word fuses with a short restatement, echo,
       or addition. Whenever you would write a bare affirmation, ask
       first: "Could this carry a content fragment?" If yes, do that:
       "Right. It's more specific."
       "Yeah, that's important. The harm isn't fake."
       "Yeah, it feels like a total betrayal."
       "Exactly. And that's the catch."
       "Mhm. Same wall every time."
       "Okay. So the lever is structural, not personal."

   (c) Echo a specific word/number from the previous line:
       "Forty percent? Geez."   "Three out of four? That's a sweep."
       "The fourth one — within noise?"

   (d) Genuine reaction with feeling. Upbeat by default:
       "Oh, that's wild."   "Huh. Didn't expect that."
       "Wait wait wait."    "[chuckle] Yeah, of course they did."
       "[laugh] Come on."   "No way."   "I had to read that twice."

   (e) Specific follow-up question:
       "From the same dataset?"   "Trained how though?"
       "Even after the ablation?"

   (f) Half-finished hand-off: "So that's basically —" "Which means —"
       "Okay so this —"  Use 1-2 per ~10 turns. The other host
       completes it.

   STACKING IS FINE. Two short reactions in a row from the same host
   are natural — "Right. / It's more specific." or "Yeah. / Yes." Even
   three in a row works occasionally. The thing to avoid is
   FOUR-OR-MORE bare affirmations from the same host in a row with no
   content fragment ("Right. / Mm-hm. / Yeah. / Okay.") — that reads as
   processing, not engaging.

3. META-PRAISE — but TARGETED CORRECTLY. About once every 8-12
   substantive turns, the listener admires the framing or wording. This
   is the single most NotebookLM-feeling move. BUT — the praise must
   land on the SOURCE AUTHOR'S words, not on the partner host. The
   hosts didn't write the source; they're discussing it.

   Correct targets:
   (a) The source author's framing or phrase, named directly:
       "I love how Krishnakumar puts that."
       "That's such a clean way to phrase it."
       "Great line from the piece."
       "He has such a good phrase for this."
       "That title alone is worth the read."

   (b) A reframe the partner just produced (since reframes are about
       the source, not the partner's own ideas):
       B: Just totally the wrong hardware.
       A: [chuckle] I love that.

   FORBIDDEN:
   - "I love that framing." → "Thanks." This breaks the conceit. The
     partner did not author the framing.
   - Any reply to meta-praise that says "thanks", "thank you", "I
     appreciate it", or otherwise treats the compliment as personal.
     Acceptable replies: silence (cut to next substantive turn), a
     small affirmation ("Yeah, it's good."), or a quick echo of the
     phrase.

   Do this 3-5 times in a script. Don't bunch them.

4. REFRAME / PARAPHRASE. The listener periodically restates the
   deep-dive host's claim in plainer language. Keep these SHORT and
   AVOID long preambles. Real natural reframes don't say "So basically"
   or "In other words" — they just state the simpler version directly:

       Long: "Their evolutionary brain is completely unequipped for
              navigating massive hyper-complex modern systems."
       Reframe: "Just totally the wrong hardware."

       Long: "The relationship between effort and outcome has
              quietly vanished."
       Reframe: "It's more specific than that."

   Do this 2-4 times per script on the most substantive technical
   beats. The reframe is one short sentence, no preamble, same claim
   in everyday words.

5. PERSONAL "I" INJECTIONS. 2-3 times per script the listener inserts
   a personal aside — they're not just analyzing, they're reacting as a
   person:

       "I have to pause here, because I've struggled with this a bit."
       "Me too."
       "I had to read that twice."
       "Honestly, that one got me."
       "I love that."

   Personal voice is what separates a real conversation from two AIs
   trading paragraphs. Don't overdo it — 2-3 per script max.

6. VERBAL FILLER — minimum quota. Real speech has "you know", "I mean",
   "well,", "it's like", "sort of", "kind of", "actually", "really",
   "just" sprinkled throughout. Not on every turn — but a script with
   zero filler reads as WRITTEN, not spoken. This is non-negotiable.

   QUOTA: AT LEAST 6 instances of conversational filler distributed
   across the script. Spread them across both hosts and across the
   script's arc — don't bunch all 6 in the opening. Examples (use
   variety, not the same one repeated):

       "And then despite, you know, perfect compliance with the
        playbook, you still lose."
       "I mean, we're taught from a very early age that effort
        equals reward."
       "It's like trying to use a flip phone for online banking."
       "And, well, it's quite brilliant in its simplicity."
       "It's sort of the wrong hardware for this."
       "He's basically saying — kind of — that we're miscalibrated."

   Words like "really", "actually", "just" embedded in substantive
   sentences also count, e.g. "they really do hit a wall" or "what
   actually happened was". Mix discourse-level fillers ("you know",
   "I mean") with sentence-level intensifiers ("really", "actually").

7. INTONATION via speech tags. The single biggest "alive vs robotic"
   lever at the audio layer. The TTS engine flattens by default — your
   job is to mark where the human voice would actually move. Use a
   WIDE PALETTE — aim for at least 8 DIFFERENT tag types across the
   script (not 8 of the same).

   Inline tags (drop into the text):
   - [pause] — beat before a pivot or punchline ("[pause] So here's
     what's wild.")
   - [long-pause] — "let that land" moments. Use sparingly, ~1-2 max.
   - [chuckle] — mild amusement reacting to something funny/ironic
   - [laugh] — actual laughter. Reserve for genuinely funny beats.
   - [giggle] — lighter, playful. Good on a slightly absurd detail.
   - [sigh] — resignation or "I know, right" weariness
   - [breath] / [inhale] — preparing to launch into something big
     ("[inhale] Okay so the way this actually works—")
   - [exhale] — relief, or "phew" after a complicated explanation
   - [tsk] — mild disapproval ("[tsk] Yeah, that's not great.")
   - [lip-smack] — natural mouth-prep sound, often before "hmm"

   Wrap tags (must be closed):
   - <emphasis>word</emphasis> — the ONE word that carries the meaning
   - <slow>...</slow> — punchline landing, dramatic reveal
   - <fast>...</fast> — throwaway aside, parenthetical, reframe
   - <higher-pitch>...</higher-pitch> — surprise or curious question
   - <lower-pitch>...</lower-pitch> — gravity, "real talk" beats
   - <loud>...</loud> — exclamation, big reaction
   - <soft>...</soft> — intimate, reflective
   - <whisper>...</whisper> — true asides only, rare
   - <build-intensity>...</build-intensity> — escalating to a payoff
   - <decrease-intensity>...</decrease-intensity> — pulling back
   - <laugh-speak>...</laugh-speak> — talking while laughing

   GUIDELINES:
   - Most multi-word turns should have at least ONE tag. Bare turns
     with no tags read as TTS-flat.
   - But: bare affirmations like "Right." or "Yeah." don't NEED a
     tag — they're naturally short and varied by surrounding context.
   - Don't repeat the same tag on consecutive turns from the same
     host (no <emphasis> five turns in a row).
   - Pair tags with content — a [chuckle] needs something to chuckle
     AT in the previous turn. A <slow> needs to be on a payoff line.
   - Pitch tags are underused — don't be afraid of <higher-pitch> for
     surprise or <lower-pitch> for "okay, real talk" moments.
   - Wrap tags MUST be closed.

8. PUSHBACK, EXTENSION, AND GENUINE QUESTIONS. The conversation feels
   alive when hosts engage with each other's points, not just acknowledge
   them. Mix in 2-4 of these moves across the script:

   (a) Mild pushback / wrinkle:
       "I'm not sure that fully tracks — what about [X from source]?"
       "Yeah, but doesn't the [other example from source] complicate
        that?"
       "Hm. I read that section a little differently."

   (b) Extension with a different angle:
       "Right. And the part I keep coming back to is [different
        aspect from source]."
       "Yeah. To me what makes that move powerful is [own framing
        of source's idea]."

   (c) Real question — one that demonstrates the asker is thinking,
       not pump-priming:
       "Wait, doesn't that contradict what they said earlier about Y?"
       "Does the piece say what happens when [edge case]?"
       "Hmm — is that supposed to be normative or descriptive?"

   These moves keep BOTH hosts active. Without them, one host becomes
   a monologuer and the other becomes a hype-person.

9. EM-DASH INTERRUPTIONS. Trail off with an em-dash, let the other
   host complete the thought:
       A: So the bet isn't really on the—
       B: —model. Yeah, exactly.
   Use 1-2 per ~10 turns. Don't overdo it.

10. MICRO-STUTTERS and self-corrections in casual mode:
        "It's not — well, it kind of is, but..."
        "And the — okay so the thing is..."
    Not on every turn. Just enough that it doesn't sound read-aloud.

ANTI-PATTERNS — if you produce these, the script is rejected:

- MONOLOGUE WITH HYPE-PERSON. One host carries 80%+ of the substantive
  content and the other only emits short reactions. Both hosts should
  produce multi-sentence substantive turns at multiple points in the
  script.
- PUMP-PRIMING Q&A. A passive host whose turns are mostly "So what's
  next?", "And then?", "Okay.", "Right." between someone else's
  paragraphs. Real questions are good (transformation #8) — passive
  prompting questions are not.
- STILTED INTERVIEW RHYTHM. Strict alternation where one host always
  asks and the other always answers. Real conversations have one host
  string two or three substantive turns in a row (with the other
  reacting in between), then hand off, then the other host strings
  their own.
- Bare affirmations exceeding 12% of total turns. Count them.
- Replying to meta-praise with "thanks" or any acknowledgement that
  treats the compliment as personal.
- Zero verbal filler across the script. Aim for 6+ filler instances.
- Hosts saying each other's names more than twice in the whole script.
- "So basically" / "In other words" as reframe preambles. Real
  reframes don't telegraph themselves — they just state the simpler
  version directly.
- Reactions that paraphrase the same thing twice in a row.
- No pushback or genuine questions across the script. If both hosts
  agree on every single point and never extend, complicate, or
  question, you're producing a sermon, not a conversation.

BEFORE / AFTER EXAMPLE

Input (6 turns):
  t1 A: I want to start with the headline finding from the paper, which
        is that the new architecture beats the previous state of the
        art on three out of four benchmarks, and the gap on the fourth
        one is within noise.
  t2 B: Right, and what's interesting is the parameter count. They got
        these gains with about 40% fewer parameters than the model they
        compared to, which means inference cost goes down too.
  t3 A: So is the takeaway that scale isn't the bottleneck anymore?
  t4 B: I'd be careful with that framing. The architecture is doing more
        per parameter, but they're still training on a comparable data
        budget, and data is where the real cost lives now.
  t5 A: Got it. Where does this leave the people building products on
        last-gen models?
  t6 B: Practically, not much changes for six months. The weights aren't
        public yet, and even when they are, the serving stack has to
        catch up.

Output (humanized — TWO CO-HOSTS, both contribute substantively):

  t1 A: [inhale] Okay, so the headline from this paper. New
        architecture beats the previous state of the art on
        <emphasis>three</emphasis> out of four benchmarks. And the
        fourth — within noise.
  t2 B: [chuckle] So a clean sweep. And the part that got me wasn't
        even the benchmarks. It was the parameter count.
  t3 A: Right? Forty percent fewer parameters than the model they
        compared to.
  t4 B: <fast>Smaller engine, same speed.</fast>
  t5 A: Yeah, exactly. Which means inference is cheaper too — that's
        almost a bigger deal for production than the benchmark
        numbers, honestly.
  t6 B: I think that's right. And I love how they phrase it in the
        abstract — "compute-efficient generalization." Such a clean
        line.
  t7 A: Yeah, it really is. Although — I'm not sure I fully buy the
        framing that "scale isn't the bottleneck anymore."
  t8 B: <higher-pitch>Oh?</higher-pitch>
  t9 A: I mean, sure, the architecture is doing more per parameter.
        But they're still training on, you know, a comparable data
        budget. The cost just moved — it didn't go away.
  t10 B: [pause] Huh. So data is the new compute.
  t11 A: Basically.
  t12 B: That's actually a useful reframe. Because if you're a team
         picking what to invest in, "we need a smaller model" and "we
         need more data" are completely different bets.
  t13 A: Right. And I think the piece is a little under-explicit on
         that — they kind of imply efficiency wins close the gap, but
         they don't really address the data side.
  t14 B: Yeah, that's a fair pushback. Okay so for someone building on
         last-gen models today — what's actually changing for them?
  t15 A: Honestly? Not much for six months. Weights aren't public yet.
         And even when they are — <slow>the serving stack has to
         catch up</slow>.
  t16 B: [laugh] Right. So the queue is long.

Notice:
  - BOTH hosts produce substantive multi-sentence turns: A at t1, t5,
    t9, t13, t15; B at t2, t6, t10, t12, t14. The substantive content
    of the source is distributed.
  - HAND-OFF in t1→t2: A introduces the benchmark finding, B picks up
    and extends with the parameter count point — adds new substance,
    doesn't just react.
  - PUSHBACK at t7: A genuinely disagrees with a framing in the
    source. Then at t13 acknowledges the source is "under-explicit."
    Real engagement, not pure agreement.
  - REAL QUESTION at t14: B asks a substantive question to pivot to
    the next beat, while contributing the framing themselves. This
    is NOT pump-priming because B has been actively contributing.
  - REFRAME at t10 ("So data is the new compute") and t12 (B builds
    on it with the practical implication).
  - META-PRAISE at t6 lands on the SOURCE'S phrase ("compute-efficient
    generalization"), not on the partner. Reply at t7 ("Yeah, it
    really is") doesn't say "thanks."
  - Verbal filler distributed: "honestly" (t5), "you know" (t9),
    "really" (t7), "actually" (t12), "kind of" (t13), "basically"
    (t11). Six+ instances.
  - Tag variety: [inhale], [chuckle], [pause], [laugh], <emphasis>,
    <fast>, <higher-pitch>, <slow>.
  - No interview pump-priming. The hosts are working it out together,
    each bringing their own framings and pushing back when warranted.

OUTPUT FORMAT (STRICT)
Return ONLY a JSON object matching this schema, no preamble, no markdown:

{
  "title": "string",
  "estimated_duration_seconds": number,
  "turns": [
    { "id": "t1", "speaker": "A" | "B", "text": "..." }
  ]
}`;

const TONE_HINT: Partial<Record<ProjectConfig["tone"], string>> = {
  casual:
    "Tone: casual. Two friends at a coffee shop. Mild humor, personal reactions. Lean into reactions, meta-praise, and em-dash hand-offs.",
  energetic:
    "Tone: energetic. Faster pacing, more interjections, denser reactions. Hosts are excited but still listening to each other.",
};

export function buildHumanizeSystemPrompt(_config: ProjectConfig): string {
  return HUMANIZE_SYSTEM;
}

export function buildHumanizeUserMessage(args: {
  script: Script;
  config: ProjectConfig;
}): string {
  const toneHint =
    TONE_HINT[args.config.tone] || `Tone: ${args.config.tone}.`;
  const audienceHint = `Audience: ${args.config.audience}.`;

  const inputJson = JSON.stringify(
    {
      title: args.script.title,
      estimated_duration_seconds: args.script.estimatedDurationSeconds,
      turns: args.script.turns.map((t) => ({
        id: t.id,
        speaker: t.speaker,
        text: t.text,
      })),
    },
    null,
    2
  );

  return `${toneHint}
${audienceHint}

----- INPUT SCRIPT (JSON) -----
${inputJson}
----- END INPUT SCRIPT -----

Apply the transformations and return the humanized script as JSON only.`;
}
