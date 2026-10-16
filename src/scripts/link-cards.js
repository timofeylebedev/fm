/* Cards that open their button's link from anywhere on the card: the purple card «От тихой рутины…» and the two tool
   cards (data-linkcard in the HTML). A link cannot hold another link, so the button stays the card's only real link
   (one stop for the Tab key, one link for screen readers) and a click anywhere else on the card is passed on to it:
     · selecting text on a card opens nothing;
     · Ctrl/⌘-click, Shift-click or a middle click opens the link in a new tab, as on any link. */
export function initLinkCards() {
  document.querySelectorAll("[data-linkcard]").forEach((card) => {
    const link = card.querySelector("a[href]");
    if (!link) return;
    const own = (e) => e.target.closest("a, button");
    const newTab = () => window.open(link.href, "_blank", "noopener");
    card.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || own(e)) return;
      const selection = getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim()) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) newTab();
      else link.click();                                     // the button's own click: the booking popup, a new tab…
    });
    card.addEventListener("auxclick", (e) => { if (e.button === 1 && !own(e)) { e.preventDefault(); newTab(); } });
  });
}
