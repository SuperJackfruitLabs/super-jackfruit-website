---
title: The engine that cut out every eight seconds
description: A looping MP3 carried 45 ms of silence. Here is how we found it and made the loop seamless.
date: 2026-10-20
draft: false
tags: [web audio, village]
sources:
  - claim: AudioBufferSourceNode loopStart and loopEnd set the part of a buffer that loops
    url: https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loopStart
  - claim: playbackRate changes how fast a buffer plays, and so how often a loop repeats
    url: https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate
---

The car in our village has an engine sound: an 8-second recording of a petrol engine, looped, and played faster as the car speeds up. It was reported as breaking up "sometimes". That word turned out to be a clue.

## Measuring instead of listening

We decoded the file in the browser and looked at the samples. A loop played end to end should be loud from its first sample to its last. This one wasn't:

- the first **25 ms** were silent
- the last **19 ms** were silent

That's 45 ms of nothing, every time the loop came round. MP3 encoders commonly pad the start and end of a file like this, and it doesn't matter in a song that plays once. In a loop it's a gap.

"Sometimes" was the speed. The game plays the engine faster as the car goes faster, which makes the loop come round sooner. Parked, the gap came every 8 seconds. At full throttle it came every three to four seconds, often enough to notice but irregular enough to seem random.

## Looping only the sound

Web Audio lets a looping buffer repeat just a slice of itself with `loopStart` and `loopEnd`. We now set them to the audible part of the file:

1. Walk in from each end until a sample is louder than a small threshold.
2. Nudge both points to a place where the wave crosses zero going up, so the two ends of the loop line up and the join doesn't click.
3. Start playback at `loopStart`, not at zero, so the first pass skips the silence too.

Measured on the real file, the loop now runs from 27.6 ms to 8026.3 ms. Both sides of the join are full-volume engine, and the two samples that meet differ by 0.003.

## Two smaller fixes on the way

- **Gear changes.** The engine's pitch climbs through each imaginary gear and drops at the next. A car cruising right at the edge of a gear flicked between two pitches. Now a gear only changes once the speed is clearly past the edge.
- **A paused browser.** A browser can pause a page's audio, when the tab is hidden or when iOS needs the speaker. Before, the engine stayed silent after that. Now the next key press or tap brings it back.

The lesson is the one we keep relearning: when something fails "sometimes", find out what that word depends on.
