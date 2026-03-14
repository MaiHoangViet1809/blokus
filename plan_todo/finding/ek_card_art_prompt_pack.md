# Exploding Kittens Art Prompt Pack

Canonical SoW: [SOW_0010_exploding_kittens_v1.md](/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md)

Canonical runtime source:
- [card_art.js](/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/card_art.js)

## Generation spec

- output type: `illustration asset`
- aspect ratio: `2:3 portrait`
- recommended size: `1024x1536`
- file naming: `<cardId>.png`
- no text, no border, no logo, no watermark
- subject centered with safe margins for card crop
- clean light removable background

### Shared style prefix

```text
playful mischievous cartoon editorial illustration, expressive cat characters, clean inked outlines, rich flat colors, polished tabletop card art
```

### Shared composition

```text
portrait 2:3 composition, single clear focal subject, centered with generous safe margins for card cropping, plain light cream removable background, no scenery clutter, easy to cut out
```

### Shared negative prompt

```text
text, typography, logo, watermark, brand marks, card frame, card border, caption, speech bubble, collage, split panels, photorealistic, 3d render, extra limbs, extra heads, malformed paws, blurry face
```

## Card index

| cardId | promptTitle | family | frame | rulesets |
| --- | --- | --- | --- | --- |
| `attack` | `Attack Cat` | `attack` | `danger` | `base, imploding, streaking, barking` |
| `skip` | `Skipping Cat` | `utility` | `warning` | `base, imploding, streaking, barking` |
| `favor` | `Favor Beggar Cat` | `steal` | `accent` | `base, imploding, streaking, barking` |
| `shuffle` | `Shuffle Magician Cat` | `deck_control` | `neutral` | `base, imploding, streaking, barking` |
| `see_the_future` | `Prophecy Cat` | `peek` | `accent` | `base, imploding, streaking, barking` |
| `nope` | `Nope Stamp Cat` | `reaction` | `danger` | `base, imploding, streaking, barking` |
| `defuse` | `Defuse Mechanic Cat` | `protection` | `success` | `base, imploding, streaking, barking` |
| `exploding_kitten` | `Exploding Kitten` | `kitten` | `danger` | `base, imploding, streaking, barking` |
| `imploding_kitten` | `Imploding Kitten` | `kitten` | `danger` | `imploding` |
| `streaking_kitten` | `Streaking Kitten` | `kitten` | `warning` | `streaking` |
| `barking_kitten` | `Barking Kitten` | `kitten` | `warning` | `barking` |
| `tower_of_power` | `Tower Cat` | `chaos` | `warning` | `barking` |
| `alter_the_future_now` | `Instant Oracle Cat` | `peek` | `accent` | `barking` |
| `personal_attack` | `Boxer Cat Challenge` | `attack` | `danger` | `barking` |
| `share_the_future` | `Shared Prophecy Cats` | `peek` | `accent` | `barking` |
| `ill_take_that` | `Claim Ticket Cat` | `steal` | `warning` | `barking` |
| `super_skip` | `Rocket Skip Cat` | `utility` | `warning` | `barking` |
| `potluck` | `Potluck Cats` | `chaos` | `neutral` | `barking` |
| `reverse` | `Reverse Conductor Cat` | `deck_control` | `accent` | `imploding` |
| `draw_from_bottom` | `Bottom Draw Cat` | `deck_control` | `neutral` | `imploding` |
| `alter_the_future` | `Calm Oracle Cat` | `peek` | `accent` | `imploding` |
| `swap_top_bottom` | `Swap Trick Cat` | `deck_control` | `neutral` | `streaking` |
| `bury` | `Gravedigger Cat` | `deck_control` | `neutral` | `barking` |
| `tacocat` | `Tacocat Mascot` | `cat` | `cat` | `base, imploding, streaking, barking` |
| `cattermelon` | `Cattermelon Mascot` | `cat` | `cat` | `base, imploding, streaking, barking` |
| `beard_cat` | `Beard Cat Mascot` | `cat` | `cat` | `base, imploding, streaking, barking` |
| `rainbow_ralphing_cat` | `Rainbow Ralphing Cat` | `cat` | `cat` | `base, imploding, streaking, barking` |
| `hairy_potato_cat` | `Hairy Potato Cat Mascot` | `cat` | `cat` | `base, imploding, streaking, barking` |
| `feral_cat` | `Feral Cat` | `cat` | `warning` | `streaking` |

## Per-card prompts

Use each prompt below as:

```text
<shared style prefix>, <card prompt below>, <shared composition>
```

- `attack`
  - `a fierce pirate cat lunging forward and aiming a toy cannon made of scratching posts, aggressive surprise attack energy, comic sparks, fast motion arc, playful chaos`
- `skip`
  - `a nimble cat springing over a hazard marker and dodging a falling card with smug confidence, quick evasive motion, light comic timing, energetic leap, playful mischief`
- `favor`
  - `a charming tuxedo cat with pleading eyes and outstretched paws asking another unseen cat for a card, dramatic begging pose, cheeky charisma, theatrical spotlight, humorous tension`
- `shuffle`
  - `a dizzy magician cat tossing a whirlwind of floating cards through the air, swirling motion, comic confusion, magical deck chaos, lively action`
- `see_the_future`
  - `a psychic cat peeking into three glowing prophecy cards hovering above a crystal ball, mystical foresight, bright magical glow, calm confidence, whimsical wonder`
- `nope`
  - `a stubborn cat slamming a giant red cancel stamp toward the viewer, hard stop reaction, emphatic refusal, comic impact burst, bold confrontation`
- `defuse`
  - `a cool mechanic cat carefully cutting the right wire on a cartoon bomb with tiny tools, focused heroic calm, clever problem solving, safe dramatic tension, bright success energy`
- `exploding_kitten`
  - `a wide-eyed kitten bursting out of a comic explosion cloud with singed fur and shocked expression, high drama, explosive impact, over-the-top comedy, chaotic danger`
- `imploding_kitten`
  - `a sinister kitten collapsing inward into a gravity spiral with warped whiskers and folded light, ominous inward force, eerie tension, surreal implosion, villainous drama`
- `streaking_kitten`
  - `a smug speedster kitten sprinting past a hidden bomb while trailing lightning-fast motion lines, reckless speed, mischievous confidence, clever danger, comic action blur`
- `barking_kitten`
  - `a barking cat-beast kitten launching visible sound shockwaves with a scrappy feral grin, noisy confrontation, wild energy, threatening comedy, disruptive force`
- `tower_of_power`
  - `a triumphant cat inside a cardboard tower fortress wearing improvised armor made of snack boxes, goofy empowerment, proud stance, cardboard fantasy, playful absurdity`
- `alter_the_future_now`
  - `a frantic oracle cat instantly rearranging glowing future cards in midair with sparks around its paws, urgent magic, rapid foresight, decisive control, bright mystical motion`
- `personal_attack`
  - `an offended cat in boxing gloves pointing back at the viewer for an immediate rematch, personal duel energy, confrontational swagger, punchy comedy, dramatic stance`
- `share_the_future`
  - `two curious cats peeking together at glowing prophecy cards floating between them, cooperative mischief, mystical curiosity, bright magical light, friendly tension`
- `ill_take_that`
  - `a sneaky cat hanging a claim tag on another unseen player's next card with a smug grin, scheming theft, comic entitlement, sharp timing, mischievous setup`
- `super_skip`
  - `a rocket-boot cat vaulting past several turns at once over stacked arrow markers, extreme acceleration, triumphant escape, exaggerated speed, energetic comedy`
- `potluck`
  - `a chaotic dinner table of cats each dropping one card into a shared central pile like a strange feast, crowded chaos, communal mischief, funny tension, lively tabletop scene`
- `reverse`
  - `a cat conductor spinning a giant direction arrow sign the opposite way with dramatic flair, sudden reversal, theatrical control, motion swirl, clever authority`
- `draw_from_bottom`
  - `a crafty cat sliding a secret card from underneath a tall deck while peeking upward, sly precision, hidden move, stealthy humor, controlled tension`
- `alter_the_future`
  - `a fortune-teller cat calmly rearranging three floating future cards with elegant paw gestures, measured foresight, graceful control, mystical calm, polished magic`
- `swap_top_bottom`
  - `a clever cat flipping the top and bottom cards of a towering deck in one impossible motion, sleight of paw, impossible card trick, playful cleverness, dynamic motion`
- `bury`
  - `a gravedigger cat tucking a card deep beneath stacked earth-like deck layers with a tiny shovel, secretive hiding, darkly funny, deliberate movement, mischievous concealment`
- `tacocat`
  - `a smug taco-themed cat mascot with crunchy shell colors and confident pose, character portrait, collectible mascot energy, playful swagger, clean silhouette`
- `cattermelon`
  - `a watermelon-pattern cat mascot rolling forward with juicy pink and green markings, bright collectible portrait, fruity absurdity, cheerful momentum, clean mascot silhouette`
- `beard_cat`
  - `a wise cat mascot with a luxurious wizard beard and mildly unimpressed expression, collectible portrait, deadpan comedy, eccentric dignity, strong shape language`
- `rainbow_ralphing_cat`
  - `a wild cat mascot blasting a bright rainbow stream in a ridiculous but cute comedic pose, collectible portrait, chaotic gross-out humor, energetic color burst, exaggerated expression`
- `hairy_potato_cat`
  - `a fluffy potato-shaped cat mascot with scrappy fur, tiny paws, and stubborn expression, collectible portrait, scruffy charm, goofy body shape, warm comedic energy`
- `feral_cat`
  - `a feral alley cat mascot crouched low, half-shadowed, ready to mimic another cat at any second, wildcard tension, gritty street-cat swagger, sharp eyes, collectible portrait with danger`
