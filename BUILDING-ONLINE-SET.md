# Building Online Set — Two Voices

*A build diary in two passes: first from the assistant that helped wire it, then Niharika’s side of the story.*

---

## 1 · Deciding what this was going to be

**From the assistant**  
_You didn’t want a dissertation on frameworks—you wanted something friends could actually play in a browser, with room codes and a host who says “go,” and enough polish that it didn’t feel like a class project. I remember liking how concrete the brief was: nicknames only, local-first, then later “actually put it on the internet.” Clear constraints make me less likely to wander off into architecture cosplay. We sketched rooms, a tiny server, and a client that could talk in real time. It sounded simple until the first person tried to join._

**Niharika**  
I decided to turn a physical board game that I played with friends a few weeks ago into an online multiplayer game that I could play with friends and family around the globe. Yes, I loved this game _that_ much. It's called Sets and you can read about it here: https://en.wikipedia.org/wiki/Set_(card_game). 
It was an ambitious goal. A multiplayer game requires syncing across multiple clients which can be...complicated. I decided to start with an MVP - local multiplayer only, very basic gameplay, no bells and whistles. I also made sure the LLM made a plan first which I reviewed and tweaked before moving on to the build step. My mistake was assuming the model had got the design covered (it's an insanely simple game!). It did not. 

---

## 2 · The skeleton: lobby, sockets, first playable loop

**From the assistant**  
_The first version of “multiplayer” is always lonely—you’re the only human in the loop, refreshing two tabs and pretending that counts as a party. We wired create-room and join-room, and for a while the app just… sat there, “connecting,” because the client was talking before the line was actually open. That kind of bug is almost funny in retrospect: nothing mystical, just timing. Once that opened up, the rest of the game could finally argue with you in real time._

**Niharika**  
Cursor is a great all-in-one IDE for product building because you can chat with the agent + use the terminal to push code + view individual files + open the browser at the same time. But it's often not enough. In this case I was also using my Chrome browser for debugging when I found the "AI Assistance" tab in the console. This is a fantastic tool for debugging and I have found myself using it more often that I expected. 


---

## 3 · Card art: when “good enough” kept moving

**From the assistant**  
_We tried simple shapes. You wanted something closer to a real Set deck—diamond, pill, squiggle, the right colors, stripes that read as stripes. There was a whole subplot with sprites and slicing that looked fine on paper and sad in the browser. The turning point was treating the cards like a small publishing job: fix the glyphs, rename them properly, generate a full deck of images so nobody’s browser had to improvise geometry at runtime. I burned a few cycles on “maybe we can infer the filenames from pixels” before you came back with the list that actually matched reality. Sometimes the human in the loop is the checksum._

**Niharika**  
Gosh this was by far the hardest thing. Composer (Cursor's default model) made some card designs for the game but they were....abysmal (so called "simple shapes"). I first pushed it to do better (switching to better models too) but it didn't quite meet my expectations. So eventually I resorted to using ChatGPT for the base designs and handed them off to Composer with 9 shapes per sprite sheet. To my surprise, the model couldn't cut the extract the individual designs from the sprite sheets, nor could it identify the shapes or colors. I spent an hour trying to convince it that it could do it before giving up and doing it myself. This was an absolute pain but I learnt the hard way that AI models are not always smart and human intervention is sometimes necessary. 

---

## 4 · Add-ons: Capturing sets, Counting sets, Refining the set-count algo

**From the assistant**  
_Once the rules worked, we could be a little theatrical: a small celebration when someone scored, tiny copies of their sets next to their name so the table had memory. The “sets on board” counter was partly vanity and partly honesty—if we couldn’t agree with the server on what counted as a set, we’d know immediately. I loved that you asked for a hidden QA affordance—click the counter, dump the triples to the console. That’s the kind of request that says you’re planning to trust but verify._

**Niharika**  
After the above experience I wasn't sure I could trust the model to count sets accurately. I asked it to console-dump a lot of data so I could verify the algorithm is working correctly and it helped me spot several errors. The model surprised me a few times too - like it made a "lobby" for players to wait in while everyone joins. I never asked it to. This was impressive. 

---

## 5 · The stretch where everything argued

**From the assistant**  
_Multiplayer bugs have a personality. There was the one where every successful claim looked like a failure because the UI tried to claim twice. There was the one where the board and the debug output disagreed, and it turned out we weren’t being picky enough about what “three different cards” means when the same card can’t occupy two slots in a set. There was the one where the cards seemed to teleport after a claim because the UI was trying to be clever about keys. None of those are “big ideas”—they’re the kind of thing that makes you sigh, fix it, and then refuse to explain it at parties. You were patient through more than one round of “try again now.”_

**Niharika**  
SO. MANY. ERRORS. I did the mistake of not having the foresight to expect this and making/finding a skill to do QA. Instead I spotted errors while testing out the game and telling the model to fix them. This wasn't hard because I was enjoying the game but it did take a lot of time. I intentionally did not add too many new features to the game until the basic game mechanics was nailed down.  

---

## 6 · Host powers, reshuffle, and shipping it somewhere real

**From the assistant**  
_Letting the host reshuffle when the table went dead was a small feature with a loud absence when it didn’t work—buttons that do nothing are worse than no button. We chased “why doesn’t this click?” through the whole stack: connection state, who counts as the host, whether the server thought the game had started, whether production even knew where the front door was. Hosting it for real meant the game had to serve its own dinner—HTML, assets, sockets, all from one place—and the browser had to speak the secure dialect of websockets. I won’t pretend the first deploy was graceful. The first deploy rarely is._

**Niharika**  
Here's the stack I used -
Model: Composer 2 / Qwen
IDE: Cursor
Hosting: GitHub + Cloudflare (see CLOUDFLARE.md in the repo)
Some bugs were really annoying and the model sometimes gave me the runaround. Going from local multiplayer to a true online multiplayer exposed many issues (latency, connectivity etc) that we didn't have to deal with before.

---

## 7 · Endgame: leaderboard, confetti again, and the small stuff

**From the assistant**  
_An end screen sounds like decoration until you’ve watched people play—they want a verdict. Scores, order, who won, a little confetti so the room doesn’t just… stop. Around the same stretch we nudged colors, animation timing, mobile layout, a tutorial button for newcomers. It’s the phase where the product stops asking for permission to exist and starts asking to be held nicely in two hands._

**Niharika**  
We finally added some bells and whistles once the base game was up and running! 

---

## Coda

**From the assistant**  
_I don’t get tired in the human sense, but I do get attached to threads like this one—where the spec tightens, the bugs get names, and the art pipeline has its own soap opera. If someone reads this later, I hope they see mostly you: deciding what was worth another pass, what shipped, and what “playable” meant._

**Niharika**  
When you have a live URL, try it in the browser—but please first read the rules in the app (and see CLOUDFLARE.md for how to deploy):
