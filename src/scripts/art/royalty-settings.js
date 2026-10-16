/* The settings of the build-up of the two royalty drawings (royalty.js).
   The eight drawings of the card stack keep moving for as long as they are on screen. The two royalty drawings build
   themselves up once and then stay as they are. Everything about that build-up is set here, for both of them. */
//
// Times. "play" is the length of the whole build-up in seconds, the same for both drawings. Every other moment or length
// of time is a part of it: 0 is the start, 1 the end, 0.1 a tenth of it. So "play" alone makes everything slower or faster.
// A share or a report that is still on its way when the time is over is not cut off: it finishes its way, and the drawing
// simply takes that little bit longer. (The labels, the rows and the sum are always ready exactly at the end.)
//
// Eases: how a movement speeds up and slows down. Each one is a GSAP ease:
//   · the name of one of your own curves from the list "curves" at the top of the settings: "smooth", "overshoot"
//   · a name: "none" (even speed), "power1.out" … "power4.out" (slowing down, more and more sharply), "sine.inOut",
//     "expo.out", "back.out(1.7)" (goes past its place and settles back: the number is how far), "elastic.out(1, 0.4)" …
//   · or a CustomEase curve, drawn in GSAP's ease visualizer (gsap.com/docs/v3/Eases). It can be written the way the visualizer
//     gives it, CustomEase.create("custom", "M0,0 C0.3,1.4 0.6,1 1,1"), or as the curve alone, "M0,0 C0.3,1.4 0.6,1 1,1",
//     or as the four numbers of a cubic-bezier, "0.3, 1.4, 0.6, 1". (Inside the quotes of a setting, write the inner quotes as ' .)
// (The same names are used on the "royalty lab" page, so the values tried out there can be pasted here as they are.)
/* ROYALTY:START */
export const ROYALTY = {
  // Curves of your own. Each is written once, here, and used by its name in the eases below ("smooth", "overshoot"):
  // change a curve and every ease that names it follows. More curves can be added to the list under names of their own.
  curves: {
    smooth: "M0,0 C0,0.371 0.046,0.601 0.244,0.8 0.443,1 0.699,1 1,1",                // slows down softly into its place
    overshoot: "M0,0 C0,0.672 0.124,1.171 0.353,1.167 0.559,1.162 0.595,1.006 1,1"   // goes about 17% past its place and settles back
  },

  play: 2.6,                    // seconds for the whole build-up of one drawing
  wait: 0.3,                    // seconds between "the card is there and the drawing is on screen" and the start
  seen: 0.35,                   // how much of a drawing's block must be on screen before it starts (0.35 = 35%)

  // royalty-1, the ring. A share appears and travels round the ring to its place; its label follows it. (Whose turn it is when: "turn" in the drawing.)
  shareGap: 0.2,                // a share starts this long after the one before it
  shareTime: 0.8,               // how long a share takes to arrive
  shareTurn: 0.3,               // how far round the ring it travels on the way: a part of the full circle (0.25 = a quarter)
  shareGrow: 0.6,               // how long it is when it appears, as a part of its own length (1 = full length from the start)
  whiteGrow: 0,                 // how long its fade from clear to white is when it appears, as a part of the length that fade has at the end (1 = full length from the start)
  shareEase: "smooth",          // its travelling and growing
  shareFade: 0.6,               // it is fully visible after this part of its way
  shareFadeEase: "power1.out",  // its fading in
  clear: 0,                     // the white of a share is gone this far before the white end of the share behind it (a part of the circle; 0 = gone exactly where that end begins)
  labelAfter: 0.02,             // a label starts this long after its own share has started
  labelTurn: 0.06,              // how far round the ring a label travels on the way
  labelEase: "overshoot",       // its travelling
  labelFade: 0.1,               // it is fully visible after this part of its way (small = hardly any moment of being see-through)
  labelFadeEase: "power2.out",  // its fading in
  sumShows: 0.6,                // the sum has faded in by this moment
  sumEase: "smooth",            // its counting up from 0, which takes the whole length
  // (a label takes the time that is left after shareGap and labelAfter, so the last label arrives exactly at the end)

  // royalty-2, the reports. They come up from below one after another; then the rows come up line by line from the top.
  sheetGap: 0.15,               // a report starts this long after the one before it
  sheetTime: 0.8,               // how long a report takes to arrive
  sheetRise: 60,                // how far below its place it starts, Figma px
  sheetEase: "overshoot",       // its rising
  sheetFade: 0.4,               // it is fully visible after this part of its way
  sheetFadeEase: "overshoot",   // its fading in (going past 1 changes nothing: fully visible is fully visible)
  rowsAt: 0.56,                 // the first line of rows starts here (the pause after the reports)
  rowTime: 0.16,                // how long one row takes to appear
  rowRise: 16,                  // how far below its place a row starts, Figma px
  rowEase: "smooth",            // its rising
  rowFadeEase: "power3.out"     // its fading in, from fully see-through
  // (the lines follow each other so that the last one is ready exactly at the end)
};
/* ROYALTY:END */
