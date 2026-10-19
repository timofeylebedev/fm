/* The visitor's consent to cookies and analytics, and the gate that anything optional (an analytics counter, a chat)
   waits behind. The notice itself (cookies.js, loaded only when it has to be shown) asks; this file only remembers.

   How the asking works:
     · consent is given by pressing «ОК» on the notice: nothing else counts. Scrolling, staying on the page or closing it
       is not an answer, so until «ОК» nothing optional runs (152-ФЗ, art. 9: consent must be specific and unambiguous;
       since 1 Sept 2025, 156-ФЗ, it must also be given apart from other documents);
     · the answer is kept for MONTHS months on this device (localStorage, not a cookie), with the date and the version of
       the text it was given to. When what the site collects changes (a new counter, a new purpose), raise VERSION:
       everyone is asked again, once;
     · a visitor who has not answered is asked again on the next visit, never twice on one page;
     · an answer given in another tab of the site is seen at once (the notice there goes away by itself);
     · fmConsent in the console: state(), grant(), withdraw() (forget the answer: the notice comes back on the next visit,
       and whatever was started stops at the next reload).

   Adding analytics (Yandex Metrica, say): start it from onConsent(), never straight from the page, and add its
   addresses to POLICY in build/plugins.js:
     import { onConsent } from "./consent.js";
     onConsent(() => { ...the counter's snippet... });
   It then starts at once for a visitor who agreed earlier, and the moment «ОК» is pressed for one who has just agreed. */

const KEY = "fm-consent";
export const VERSION = 1;                  // raise when what is collected changes: everyone is asked again
const MONTHS = 12;                         // how long an answer is kept

let memory = null;                         // where storage is not available (some private windows): this page only
// what was saved on this page comes first: where storage can be read but not written (full, some private modes),
// an «ОК» still counts on this page
const load = () => {
  if (memory) return memory;
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
};
const save = (v) => {
  memory = v;
  try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {}
};
const valid = (v) => {
  if (!v || v.v !== VERSION || !v.at) return false;
  const at = new Date(v.at), until = new Date(v.at);
  if (!(at <= new Date())) return false;                 // a date in the future (or none at all) is not an answer
  until.setMonth(until.getMonth() + MONTHS);
  return until > new Date();
};

const waiting = [];
const run = () => { while (waiting.length) { try { waiting.shift()(); } catch (e) { console.error(e); } } };

export const hasConsent = () => valid(load());

// fn runs once consent is there: at once if it already is, else the moment it is given (in this tab or another one)
export function onConsent(fn) {
  waiting.push(fn);
  if (hasConsent()) run();
}

export function grant() {
  save({ v: VERSION, at: new Date().toISOString() });
  run();
  document.dispatchEvent(new CustomEvent("fm:consent"));
}

export function withdraw() { memory = null; save(null); }

// an answer given in another tab
addEventListener("storage", (e) => {
  if (e.key !== KEY || !hasConsent()) return;
  run();
  document.dispatchEvent(new CustomEvent("fm:consent", { detail: { elsewhere: true } }));
});

window.fmConsent = { state: () => load(), grant, withdraw, version: VERSION };
