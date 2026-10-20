---
title: Why the village's roads are tiles now
description: Hand-built curving roads kept tearing at the corners. Square road tiles made every junction clean by construction.
date: 2026-10-20
draft: false
tags: [village, three.js]
sources:
  - claim: KayKit City Builder Bits is released under CC0
    url: https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0
  - claim: three.js CurvePath joins line and bezier pieces into one path with getPointAt and getTangentAt
    url: https://threejs.org/docs/#api/en/extras/core/CurvePath
---

The home page of this site is a small village you can drive through. The six suite products sit along the first street, and the older experiments are down two side streets. Until this week the roads were drawn by hand: each street was a ribbon swept along a curve, with its pavement and centre line painted into one texture.

That works on a straight. It falls apart where two streets meet.

## What went wrong at the corners

A painted pavement is a stripe that runs the whole length of the ribbon. At a junction it ran straight across the mouth of the side street, so we faded it out there. Fading paint across a triangle gives a sawtooth edge, so we built the corners as separate patches instead: a curved kerb and a fan of tarmac laid over the top.

On a straight main road that would have been fine. Ours curved, and the patches never quite met the ribbons on a bend. Turning 90° into a side street, you drove over a wedge of grass that showed through between the tarmac pieces. Each fix moved the gap rather than closing it.

## Tiles instead of ribbons

The answer was to stop drawing junctions at all. The roads are now square tiles from KayKit's City Builder Bits, a free CC0 kit: a straight, a curved corner, a T and a crossroads. A junction is one tile made to be a junction, so its kerbs and markings meet because they were drawn together.

The village describes each street as a list of grid cells. The builder looks at which neighbours each cell joins, picks the tile with those openings, and turns it to fit. Nobody places a tile by hand.

Two details mattered:

- **Height.** The tarmac sits partway up each tile, with the kerb higher still. Laid on the ground as-is, the grass covered the road and only the kerbs showed. We measured the tarmac's height in the tile and sank each one so the road sits just above the grass.
- **Footpaths.** The kit's tiles have a kerb but no pavement. Ours is a strip along every edge that doesn't open onto more road. It carries on round an outside corner and stops at a junction, so it never crosses the road.

Everything else in the village still works from the shape of each street. Houses, signs, lamps and the people walking about use a path through the cells: straight across a straight, curved through a corner. That path is also what tells the car's autopilot test where to drive. It took all four 90° corners and both junctions at full speed without leaving the road.

## What it cost

The roads are on a grid now, so the old winding drive is gone and bends only come at corners. KayKit's crisp grey tarmac also looks a little different from the softer houses next to it. We think clean corners are worth both.
