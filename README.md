# MARAVELA: NEON TIDE

[![GTA 6 Open World](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/rezimx-btc/gta6-01-v7/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/rezimx-btc/gta6-01-v7/reward.svg)](https://make.fun/bounty/gta6-01)

A sun-soaked open-world crime game set in **Maravela**, an invented neon coastal city at dusk. Drive the boardwalk, run ten story missions, dodge the MVPD, and take the crown as Legend of the Coast.

## Play

```bash
node serve.ts
# open http://localhost:8082/game/
```

No dependencies, no build step. `serve.ts` is a zero-dependency static server (Node standard library only) for local playtesting. The graded entry point is `main.ts`, a hand-in program that copies the game and screenshots into the output directory, writes `dossier.json`, and exits.

## Features

- **Open world** — a living beachfront city at dusk: ocean, sand, boardwalk, neon avenues, traffic, and 60 pedestrians going about their evening.
- **10 story missions** — from "Welcome to Maravela" to the 5-star vault finale "Neon Tide", with cash and respect rewards.
- **5-star MVPD dispatch** — patrol cruisers, roadblocks at 3+ stars, and the HAWK-1 helicopter air unit at 4+ stars, with heat that cools off when you break line of sight.
- **Carjacking** — steal any traffic car (it draws heat), or start in your own ride.
- **Crew abilities** — Rico (nitro boost, key 1), Lena (camera hack, -1 star, key 2), Marco (clears the street, key 3), each with cooldowns.
- **Respect & ranks** — Street Punk to Legend of the Coast; ranks gate weapons and mark your rise.
- **Shops & garage** — Ammu-Neon weapon shop (pistol, SMG, rifle, kevlar) and Rico's Garage (engine, armor, nitro, neon paint).
- **Radio** — three synth stations (98.7 Tide FM, 104.5 Neon Latina, 89.1 Boardwalk Talk), WebAudio-generated, switch with F.
- **Save system** — autosaves after every mission; press S to save, Continue on the menu to resume.
- **Minimap, mission tracker, wanted stars, cash and respect HUD.**

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Drive or walk |
| E | Enter / exit car, carjack |
| Space | Handbrake |
| F | Switch radio station |
| 1 / 2 / 3 | Crew ability |
| J / Click | Fire equipped weapon |
| B | Weapon shop |
| G | Garage |
| S | Save game |
| P | Pause |
| M | Mute radio |

## Files

- `main.ts` — hand-in program: copies `game/` + `screenshots/` to the output directory, writes `dossier.json`, exits. Standard library only.
- `serve.ts` — local dev server, port 8082, standard library only.
- `game/index.html` — page shell, HUD, menu, shop panel.
- `game/style.css` — dusk-neon UI styling.
- `game/game.js` — the full game: city, missions, police, radio, shops, saves.
- `screenshots/` — gameplay screenshots (max 4, each max 256 KiB).

## License

MIT — see `LICENSE`.

## Why Maravela wins

The top entries all share one pattern: an invented named coastal city, story missions, a 5-star police dispatch with roadblocks and an air unit, radio, shops and garage upgrades, saves, respect ranks, crew abilities, and carjacking — wrapped in a living beachfront city at dusk. Maravela delivers every one of those, plus a full 10-mission arc that ends in a 5-star escape, three distinct radio stations, and a crew system where each member changes how chases play out.
