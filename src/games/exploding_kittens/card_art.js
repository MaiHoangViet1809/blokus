import { EK_BASE_SUPPLY, EK_EXPANSION_SUPPLY, EK_RULESETS } from "./shared.js";

const ALL_RULESETS = Object.keys(EK_RULESETS);

export const EK_CARD_PROMPT_SPEC = {
  language: "English",
  outputTarget: "portrait illustration asset",
  aspectRatio: "2:3",
  recommendedSize: "1024x1536",
  stylePrefix: "playful mischievous cartoon editorial illustration, expressive cat characters, clean inked outlines, rich flat colors, polished tabletop card art",
  background: "plain light cream removable background, no scenery clutter, easy to cut out",
  composition: "portrait 2:3 composition, single clear focal subject, centered with generous safe margins for card cropping",
  negativePrompt: "text, typography, logo, watermark, brand marks, card frame, card border, caption, speech bubble, collage, split panels, photorealistic, 3d render, extra limbs, extra heads, malformed paws, blurry face"
};

const FAMILY_DISPLAY = {
  kitten: "Kitten",
  cat: "Collectible Cat",
  reaction: "Reaction",
  protection: "Protection",
  attack: "Attack",
  peek: "Future Peek",
  deck_control: "Deck Control",
  steal: "Steal",
  chaos: "Chaos",
  utility: "Utility"
};

function buildSupplySummary(cardId) {
  return {
    base: EK_BASE_SUPPLY[cardId] || 0,
    imploding: EK_EXPANSION_SUPPLY.imploding[cardId] || 0,
    streaking: EK_EXPANSION_SUPPLY.streaking[cardId] || 0,
    barking: EK_EXPANSION_SUPPLY.barking[cardId] || 0
  };
}

function buildRulesetPresence(cardId) {
  if (EK_BASE_SUPPLY[cardId]) return ALL_RULESETS;
  return ALL_RULESETS.filter((ruleset) => (EK_EXPANSION_SUPPLY[ruleset]?.[cardId] || 0) > 0);
}

function buildPrompt(subject, actionMood) {
  return [
    EK_CARD_PROMPT_SPEC.stylePrefix,
    subject,
    actionMood,
    EK_CARD_PROMPT_SPEC.composition,
    EK_CARD_PROMPT_SPEC.background
  ].join(", ");
}

function createArtEntry({
  cardId,
  family,
  frameVariant,
  titleLine,
  tagLine,
  promptTitle,
  promptSubject,
  promptMood,
  characterGroup = ""
}) {
  return {
    cardId,
    artCode: cardId,
    family,
    familyLabel: FAMILY_DISPLAY[family] || family,
    frameVariant,
    titleLine,
    tagLine,
    illustrationMode: "illustration_asset",
    promptTitle,
    prompt: buildPrompt(promptSubject, promptMood),
    negativePrompt: EK_CARD_PROMPT_SPEC.negativePrompt,
    composition: EK_CARD_PROMPT_SPEC.composition,
    rulesetPresence: buildRulesetPresence(cardId),
    supplySummary: buildSupplySummary(cardId),
    ...(characterGroup ? { characterGroup } : {})
  };
}

export const EK_CARD_ART = {
  attack: createArtEntry({
    cardId: "attack",
    family: "attack",
    frameVariant: "danger",
    titleLine: "Attack",
    tagLine: "Pile pressure on the next player.",
    promptTitle: "Attack Cat",
    promptSubject: "a fierce pirate cat lunging forward and aiming a toy cannon made of scratching posts",
    promptMood: "aggressive surprise attack energy, comic sparks, fast motion arc, playful chaos"
  }),
  skip: createArtEntry({
    cardId: "skip",
    family: "utility",
    frameVariant: "warning",
    titleLine: "Skip",
    tagLine: "Dodge the draw and keep moving.",
    promptTitle: "Skipping Cat",
    promptSubject: "a nimble cat springing over a hazard marker and dodging a falling card with smug confidence",
    promptMood: "quick evasive motion, light comic timing, energetic leap, playful mischief"
  }),
  favor: createArtEntry({
    cardId: "favor",
    family: "steal",
    frameVariant: "accent",
    titleLine: "Favor",
    tagLine: "Make a rival hand one over.",
    promptTitle: "Favor Beggar Cat",
    promptSubject: "a charming tuxedo cat with pleading eyes and outstretched paws asking another unseen cat for a card",
    promptMood: "dramatic begging pose, cheeky charisma, theatrical spotlight, humorous tension"
  }),
  shuffle: createArtEntry({
    cardId: "shuffle",
    family: "deck_control",
    frameVariant: "neutral",
    titleLine: "Shuffle",
    tagLine: "Stir chaos back into the deck.",
    promptTitle: "Shuffle Magician Cat",
    promptSubject: "a dizzy magician cat tossing a whirlwind of floating cards through the air",
    promptMood: "swirling motion, comic confusion, magical deck chaos, lively action"
  }),
  see_the_future: createArtEntry({
    cardId: "see_the_future",
    family: "peek",
    frameVariant: "accent",
    titleLine: "See The Future",
    tagLine: "Peek at the next three cards.",
    promptTitle: "Prophecy Cat",
    promptSubject: "a psychic cat peeking into three glowing prophecy cards hovering above a crystal ball",
    promptMood: "mystical foresight, bright magical glow, calm confidence, whimsical wonder"
  }),
  nope: createArtEntry({
    cardId: "nope",
    family: "reaction",
    frameVariant: "danger",
    titleLine: "Nope",
    tagLine: "Cancel the last thing that happened.",
    promptTitle: "Nope Stamp Cat",
    promptSubject: "a stubborn cat slamming a giant red cancel stamp toward the viewer",
    promptMood: "hard stop reaction, emphatic refusal, comic impact burst, bold confrontation"
  }),
  defuse: createArtEntry({
    cardId: "defuse",
    family: "protection",
    frameVariant: "success",
    titleLine: "Defuse",
    tagLine: "Disarm disaster before it goes off.",
    promptTitle: "Defuse Mechanic Cat",
    promptSubject: "a cool mechanic cat carefully cutting the right wire on a cartoon bomb with tiny tools",
    promptMood: "focused heroic calm, clever problem solving, safe dramatic tension, bright success energy"
  }),
  exploding_kitten: createArtEntry({
    cardId: "exploding_kitten",
    family: "kitten",
    frameVariant: "danger",
    titleLine: "Exploding Kitten",
    tagLine: "The deck's loudest problem.",
    promptTitle: "Exploding Kitten",
    promptSubject: "a wide-eyed kitten bursting out of a comic explosion cloud with singed fur and shocked expression",
    promptMood: "high drama, explosive impact, over-the-top comedy, chaotic danger",
    characterGroup: "doomed_kittens"
  }),
  imploding_kitten: createArtEntry({
    cardId: "imploding_kitten",
    family: "kitten",
    frameVariant: "danger",
    titleLine: "Imploding Kitten",
    tagLine: "Fold the doom inward and send it back.",
    promptTitle: "Imploding Kitten",
    promptSubject: "a sinister kitten collapsing inward into a gravity spiral with warped whiskers and folded light",
    promptMood: "ominous inward force, eerie tension, surreal implosion, villainous drama",
    characterGroup: "doomed_kittens"
  }),
  streaking_kitten: createArtEntry({
    cardId: "streaking_kitten",
    family: "kitten",
    frameVariant: "warning",
    titleLine: "Streaking Kitten",
    tagLine: "Hide danger in plain sight.",
    promptTitle: "Streaking Kitten",
    promptSubject: "a smug speedster kitten sprinting past a hidden bomb while trailing lightning-fast motion lines",
    promptMood: "reckless speed, mischievous confidence, clever danger, comic action blur",
    characterGroup: "chaos_kittens"
  }),
  barking_kitten: createArtEntry({
    cardId: "barking_kitten",
    family: "kitten",
    frameVariant: "warning",
    titleLine: "Barking Kitten",
    tagLine: "Twin trouble hunts the weakest target.",
    promptTitle: "Barking Kitten",
    promptSubject: "a barking cat-beast kitten launching visible sound shockwaves with a scrappy feral grin",
    promptMood: "noisy confrontation, wild energy, threatening comedy, disruptive force",
    characterGroup: "chaos_kittens"
  }),
  tower_of_power: createArtEntry({
    cardId: "tower_of_power",
    family: "chaos",
    frameVariant: "warning",
    titleLine: "Tower of Power",
    tagLine: "Pocket extra cards in the tower.",
    promptTitle: "Tower Cat",
    promptSubject: "a triumphant cat inside a cardboard tower fortress wearing improvised armor made of snack boxes",
    promptMood: "goofy empowerment, proud stance, cardboard fantasy, playful absurdity"
  }),
  alter_the_future_now: createArtEntry({
    cardId: "alter_the_future_now",
    family: "peek",
    frameVariant: "accent",
    titleLine: "Alter The Future NOW",
    tagLine: "Reorder destiny at instant speed.",
    promptTitle: "Instant Oracle Cat",
    promptSubject: "a frantic oracle cat instantly rearranging glowing future cards in midair with sparks around its paws",
    promptMood: "urgent magic, rapid foresight, decisive control, bright mystical motion"
  }),
  personal_attack: createArtEntry({
    cardId: "personal_attack",
    family: "attack",
    frameVariant: "danger",
    titleLine: "Personal Attack",
    tagLine: "Take another turn, personally.",
    promptTitle: "Boxer Cat Challenge",
    promptSubject: "an offended cat in boxing gloves pointing back at the viewer for an immediate rematch",
    promptMood: "personal duel energy, confrontational swagger, punchy comedy, dramatic stance"
  }),
  share_the_future: createArtEntry({
    cardId: "share_the_future",
    family: "peek",
    frameVariant: "accent",
    titleLine: "Share The Future",
    tagLine: "Let another player peek too.",
    promptTitle: "Shared Prophecy Cats",
    promptSubject: "two curious cats peeking together at glowing prophecy cards floating between them",
    promptMood: "cooperative mischief, mystical curiosity, bright magical light, friendly tension"
  }),
  ill_take_that: createArtEntry({
    cardId: "ill_take_that",
    family: "steal",
    frameVariant: "warning",
    titleLine: "I'll Take That",
    tagLine: "Claim the next card they draw.",
    promptTitle: "Claim Ticket Cat",
    promptSubject: "a sneaky cat hanging a claim tag on another unseen player's next card with a smug grin",
    promptMood: "scheming theft, comic entitlement, sharp timing, mischievous setup"
  }),
  super_skip: createArtEntry({
    cardId: "super_skip",
    family: "utility",
    frameVariant: "warning",
    titleLine: "Super Skip",
    tagLine: "Burn every draw at once.",
    promptTitle: "Rocket Skip Cat",
    promptSubject: "a rocket-boot cat vaulting past several turns at once over stacked arrow markers",
    promptMood: "extreme acceleration, triumphant escape, exaggerated speed, energetic comedy"
  }),
  potluck: createArtEntry({
    cardId: "potluck",
    family: "chaos",
    frameVariant: "neutral",
    titleLine: "Potluck",
    tagLine: "Everyone contributes to the top stack.",
    promptTitle: "Potluck Cats",
    promptSubject: "a chaotic dinner table of cats each dropping one card into a shared central pile like a strange feast",
    promptMood: "crowded chaos, communal mischief, funny tension, lively tabletop scene"
  }),
  reverse: createArtEntry({
    cardId: "reverse",
    family: "deck_control",
    frameVariant: "accent",
    titleLine: "Reverse",
    tagLine: "Turn the order around.",
    promptTitle: "Reverse Conductor Cat",
    promptSubject: "a cat conductor spinning a giant direction arrow sign the opposite way with dramatic flair",
    promptMood: "sudden reversal, theatrical control, motion swirl, clever authority"
  }),
  draw_from_bottom: createArtEntry({
    cardId: "draw_from_bottom",
    family: "deck_control",
    frameVariant: "neutral",
    titleLine: "Draw From Bottom",
    tagLine: "Take the hidden card instead.",
    promptTitle: "Bottom Draw Cat",
    promptSubject: "a crafty cat sliding a secret card from underneath a tall deck while peeking upward",
    promptMood: "sly precision, hidden move, stealthy humor, controlled tension"
  }),
  alter_the_future: createArtEntry({
    cardId: "alter_the_future",
    family: "peek",
    frameVariant: "accent",
    titleLine: "Alter The Future",
    tagLine: "Rearrange the next three cards.",
    promptTitle: "Calm Oracle Cat",
    promptSubject: "a fortune-teller cat calmly rearranging three floating future cards with elegant paw gestures",
    promptMood: "measured foresight, graceful control, mystical calm, polished magic"
  }),
  swap_top_bottom: createArtEntry({
    cardId: "swap_top_bottom",
    family: "deck_control",
    frameVariant: "neutral",
    titleLine: "Swap Top & Bottom",
    tagLine: "Trade the first and last cards.",
    promptTitle: "Swap Trick Cat",
    promptSubject: "a clever cat flipping the top and bottom cards of a towering deck in one impossible motion",
    promptMood: "sleight of paw, impossible card trick, playful cleverness, dynamic motion"
  }),
  bury: createArtEntry({
    cardId: "bury",
    family: "deck_control",
    frameVariant: "neutral",
    titleLine: "Bury",
    tagLine: "Hide a card deeper in the deck.",
    promptTitle: "Gravedigger Cat",
    promptSubject: "a gravedigger cat tucking a card deep beneath stacked earth-like deck layers with a tiny shovel",
    promptMood: "secretive hiding, darkly funny, deliberate movement, mischievous concealment"
  }),
  tacocat: createArtEntry({
    cardId: "tacocat",
    family: "cat",
    frameVariant: "cat",
    titleLine: "Tacocat",
    tagLine: "A smug taco-striped trickster.",
    promptTitle: "Tacocat Mascot",
    promptSubject: "a smug taco-themed cat mascot with crunchy shell colors and confident pose",
    promptMood: "character portrait, collectible mascot energy, playful swagger, clean silhouette",
    characterGroup: "collectible_cats"
  }),
  cattermelon: createArtEntry({
    cardId: "cattermelon",
    family: "cat",
    frameVariant: "cat",
    titleLine: "Cattermelon",
    tagLine: "Juicy chaos in cat form.",
    promptTitle: "Cattermelon Mascot",
    promptSubject: "a watermelon-pattern cat mascot rolling forward with juicy pink and green markings",
    promptMood: "bright collectible portrait, fruity absurdity, cheerful momentum, clean mascot silhouette",
    characterGroup: "collectible_cats"
  }),
  beard_cat: createArtEntry({
    cardId: "beard_cat",
    family: "cat",
    frameVariant: "cat",
    titleLine: "Beard Cat",
    tagLine: "A beard with a cat attached.",
    promptTitle: "Beard Cat Mascot",
    promptSubject: "a wise cat mascot with a luxurious wizard beard and mildly unimpressed expression",
    promptMood: "collectible portrait, deadpan comedy, eccentric dignity, strong shape language",
    characterGroup: "collectible_cats"
  }),
  rainbow_ralphing_cat: createArtEntry({
    cardId: "rainbow_ralphing_cat",
    family: "cat",
    frameVariant: "cat",
    titleLine: "Rainbow-Ralphing Cat",
    tagLine: "A spectacularly gross icon.",
    promptTitle: "Rainbow Ralphing Cat",
    promptSubject: "a wild cat mascot blasting a bright rainbow stream in a ridiculous but cute comedic pose",
    promptMood: "collectible portrait, chaotic gross-out humor, energetic color burst, exaggerated expression",
    characterGroup: "collectible_cats"
  }),
  hairy_potato_cat: createArtEntry({
    cardId: "hairy_potato_cat",
    family: "cat",
    frameVariant: "cat",
    titleLine: "Hairy Potato Cat",
    tagLine: "A scruffy potato-shaped gremlin.",
    promptTitle: "Hairy Potato Cat Mascot",
    promptSubject: "a fluffy potato-shaped cat mascot with scrappy fur, tiny paws, and stubborn expression",
    promptMood: "collectible portrait, scruffy charm, goofy body shape, warm comedic energy",
    characterGroup: "collectible_cats"
  }),
  feral_cat: createArtEntry({
    cardId: "feral_cat",
    family: "cat",
    frameVariant: "warning",
    titleLine: "Feral Cat",
    tagLine: "A wildcard copycat prowler.",
    promptTitle: "Feral Cat",
    promptSubject: "a feral alley cat mascot crouched low, half-shadowed, ready to mimic another cat at any second",
    promptMood: "wildcard tension, gritty street-cat swagger, sharp eyes, collectible portrait with danger",
    characterGroup: "collectible_cats"
  })
};

export function cardArt(cardId) {
  return EK_CARD_ART[cardId] || null;
}
