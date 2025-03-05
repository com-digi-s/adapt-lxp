/*!
  * boarding.js@3.6.0 (https://josias-r.github.io/boarding.js/)
  * Copyright (c) Josias Ribi
  * Licensed under MIT (https://github.com/josias-r/boarding.js/blob/master/license)
  */
var N = Object.defineProperty;
var M = (p, t, e) => t in p ? N(p, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : p[t] = e;
var a = (p, t, e) => (M(p, typeof t != "symbol" ? t + "" : t, e), e);
const A = "rgb(0,0,0)";
const L = "boarding-popover-item", I = "boarding-clearfix", V = "boarding-btn-group", R = "boarding-popover-tip", $ = "boarding-popover-title", W = "boarding-popover-description", F = "boarding-popover-footer", U = "boarding-popover-footer-hidden", B = "boarding-popover-element-missing", G = "boarding-close-btn", Y = "boarding-next-btn", q = "boarding-prev-btn", K = "boarding-navigation-btns", O = "boarding-coutout-svg", b = "boarding-highlighted-element";
const C = "boarding-no-pointer-events", S = "boarding-strict-pointer-events", w = "boarding-disabled", y = "boarding-close-only-btn", z = (p = "") => {
  const t = document.createElement("div");
  t.id = L, t.className = p;
  const e = document.createElement("div");
  e.classList.add(R);
  const i = document.createElement("div");
  i.classList.add($), i.innerText = "Popover Title";
  const n = document.createElement("div");
  n.classList.add(W), n.innerText = "Popover Description";
  const o = document.createElement("div");
  o.classList.add(F, I);
  const h = document.createElement("button");
  h.classList.add(G), h.innerText = "Close";
  const r = document.createElement("span");
  r.classList.add(V, K);
  const s = document.createElement("button");
  s.classList.add(q), s.innerText = "&larr; Previous";
  const l = document.createElement("button");
  return l.classList.add(Y), l.innerText = "Next &rarr;", r.appendChild(s), r.appendChild(l), o.appendChild(h), o.appendChild(r), t.appendChild(e), t.appendChild(i), t.appendChild(n), t.appendChild(o), {
    popoverWrapper: t,
    popoverTip: e,
    popoverTitle: i,
    popoverDescription: n,
    popoverFooter: o,
    popoverPrevBtn: s,
    popoverNextBtn: l,
    popoverCloseBtn: h,
    popoverFooterBtnGroup: r
  };
};
function m(p, t, e, i) {
  return (p /= i / 2) < 1 ? e / 2 * p * p + t : -e / 2 * (--p * (p - 2) - 1) + t;
}
function H(p, t, e) {
  const i = (o, h) => {
    const r = o.target;
    p.contains(r) && ((!e || e(r)) && o.preventDefault(), o.stopPropagation(), o.stopImmediatePropagation(), h == null || h(o));
  };
  document.addEventListener("pointerdown", i, !0), document.addEventListener("mousedown", i, !0), document.addEventListener("pointerup", i, !0), document.addEventListener("mouseup", i, !0), document.addEventListener(
    "click",
    (o) => {
      i(o, t);
    },
    !0
  );
}
function X(p) {
  if (!p || !("nodeType" in p && p.nodeType === 1 && typeof p.nodeName == "string"))
    throw new Error("Html Element expected");
}
function v(p, t) {
  return typeof t > "u" ? p : t;
}
function d(p) {
  if (!p)
    throw new Error(
      `Variable was expected to not be falsy, but isntead was: ${p}`
    );
}
function j(p) {
  const t = p.getBoundingClientRect();
  return t.top >= 0 && t.left >= 0 && t.bottom <= (window.innerHeight || document.documentElement.clientHeight) && t.right <= (window.innerWidth || document.documentElement.clientWidth);
}
function x(p, t) {
  !p || j(p) || p.scrollIntoView(t);
}
function k({
  hightlightBox: p,
  padding: t = 0,
  radius: e = 0
}) {
  const i = window.innerWidth, n = window.innerHeight, o = p.width + t * 2, h = p.height + t * 2, r = Math.min(
    e,
    o / 2,
    h / 2
  ), s = Math.floor(Math.max(r, 0)), l = p.x - t + s, c = p.y - t, u = o - s * 2, g = h - s * 2;
  return `M${i},0L0,0L0,${n}L${i},${n}L${i},0Z
    M${l},${c} h${u} a${s},${s} 0 0 1 ${s},${s} v${g} a${s},${s} 0 0 1 -${s},${s} h-${u} a${s},${s} 0 0 1 -${s},-${s} v-${g} a${s},${s} 0 0 1 ${s},-${s} z`;
}
function J({
  hightlightBox: p,
  padding: t = 0,
  fillColor: e = "rgb(0,0,0)",
  opacity: i = 1,
  animated: n = !0
}) {
  const o = window.innerWidth, h = window.innerHeight, r = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  r.classList.add(O), n && r.classList.add(`${O}-animated`), r.setAttribute("viewBox", `0 0 ${o} ${h}`), r.setAttribute("xmlSpace", "preserve"), r.setAttribute("xmlnsXlink", "http://www.w3.org/1999/xlink"), r.setAttribute("version", "1.1"), r.setAttribute("preserveAspectRatio", "xMinYMin slice"), r.style.fillRule = "evenodd", r.style.clipRule = "evenodd", r.style.strokeLinejoin = "round", r.style.strokeMiterlimit = "2", r.style.zIndex = "10000", r.style.position = "fixed", r.style.top = "0", r.style.left = "0", r.style.width = "100%", r.style.height = "100%";
  const s = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  return s.setAttribute(
    "d",
    k({ hightlightBox: p, padding: t })
  ), s.style.fill = e, s.style.opacity = `${i}`, s.style.pointerEvents = "auto", s.style.cursor = "pointer", r.appendChild(s), r;
}
class Q {
  constructor(t) {
    a(this, "options");
    a(this, "cutoutSVGElement");
    a(this, "currentTransitionInProgress");
    a(this, "activeSvgCutoutDefinition");
    a(this, "highlightElemRect");
    a(this, "currentHighlightedElement");
    a(this, "previouslyHighlightedElement");
    this.options = {
      ...t,
      opacity: t.opacity === void 0 ? 0.75 : t.opacity,
      overlayColor: t.overlayColor === void 0 ? A : t.overlayColor
    };
  }
  highlight(t) {
    t.isSame(this.currentHighlightedElement) || (t.onBeforeHighlighted(), this.currentHighlightedElement && !this.currentHighlightedElement.isSame(this.previouslyHighlightedElement) && this.currentHighlightedElement.onDeselected(), this.startElementTracking(
      this.currentHighlightedElement || t,
      t
    ), this.previouslyHighlightedElement = this.currentHighlightedElement, this.currentHighlightedElement = t, t.onHighlighted());
  }
  clear(t = !1, e) {
    var i, n, o;
    this.currentHighlightedElement && ((n = (i = this.options).onReset) == null || n.call(i, this.currentHighlightedElement, e)), (o = this.currentHighlightedElement) == null || o.onDeselected(), this.currentHighlightedElement = void 0, this.previouslyHighlightedElement = void 0, this.cancelElementTracking(), this.options.animate && !t ? this.unmountCutoutElement() : this.unmountCutoutElement();
  }
  startElementTracking(t, e) {
    const n = Date.now(), o = () => {
      const h = Date.now() - n;
      this.currentTransitionInProgress === o && (this.options.animate && h < 400 ? this.transitionCutoutToPosition(
        h,
        400,
        t,
        e
      ) : this.trackElementOnScreen(), this.refreshSvgAndPopover(), window.requestAnimationFrame(o));
    };
    this.currentTransitionInProgress = o, window.requestAnimationFrame(o);
  }
  transitionCutoutToPosition(t, e, i, n) {
    const o = this.activeSvgCutoutDefinition ? {
      ...this.activeSvgCutoutDefinition,
      hightlightBox: { ...this.activeSvgCutoutDefinition.hightlightBox }
    } : {
      hightlightBox: i.getDOMRect(),
      padding: i.getCustomPadding(),
      radius: i.getCustomRadius()
    }, h = n.getDOMRect(), r = v(
      this.options.padding,
      n.getCustomPadding()
    ), s = v(
      this.options.radius,
      n.getCustomRadius()
    ), l = v(
      this.options.padding,
      o.padding
    ), c = v(
      this.options.radius,
      o.radius
    ), u = m(
      t,
      o.hightlightBox.x,
      h.x - o.hightlightBox.x,
      e
    ), g = m(
      t,
      o.hightlightBox.y,
      h.y - o.hightlightBox.y,
      e
    ), f = m(
      t,
      o.hightlightBox.width,
      h.width - o.hightlightBox.width,
      e
    ), E = m(
      t,
      o.hightlightBox.height,
      h.height - o.hightlightBox.height,
      e
    ), _ = m(
      t,
      l,
      r - l,
      e
    ), D = m(
      t,
      c,
      s - c,
      e
    ), P = {
      hightlightBox: { x: u, y: g, width: f, height: E },
      padding: _,
      radius: D
    };
    this.activeSvgCutoutDefinition = P, this.updateCutoutPosition(P);
  }
  cancelElementTracking() {
    this.currentTransitionInProgress = void 0, this.activeSvgCutoutDefinition = void 0, this.highlightElemRect = void 0;
  }
  trackElementOnScreen() {
    if (this.currentHighlightedElement) {
      const t = this.currentHighlightedElement.getDOMRect();
      if (JSON.stringify(t) !== JSON.stringify(this.highlightElemRect)) {
        const e = {
          hightlightBox: {
            x: t.x,
            y: t.y,
            width: t.width,
            height: t.height
          },
          padding: v(
            this.options.padding,
            this.currentHighlightedElement.getCustomPadding()
          ),
          radius: v(
            this.options.radius,
            this.currentHighlightedElement.getCustomRadius()
          )
        };
        this.updateCutoutPosition(e), this.activeSvgCutoutDefinition = e;
      }
      this.highlightElemRect = t;
    }
  }
  refreshSvgAndPopover() {
    var i;
    d(this.cutoutSVGElement), d(this.currentHighlightedElement);
    const t = window.innerWidth, e = window.innerHeight;
    this.cutoutSVGElement.setAttribute("viewBox", `0 0 ${t} ${e}`), (i = this.currentHighlightedElement.getPopover()) == null || i.refresh();
  }
  getOverlayElement() {
    return this.cutoutSVGElement;
  }
  mountCutoutElement(t) {
    if (this.cutoutSVGElement)
      throw new Error("Already mounted SVG");
    const e = J(t);
    this.cutoutSVGElement = e, document.body.appendChild(e), H(this.cutoutSVGElement, (i) => {
      i.target.tagName === "path" && this.options.onOverlayClick();
    });
  }
  unmountCutoutElement() {
    if (!this.cutoutSVGElement)
      throw new Error("No SVG found to unmount");
    document.body.removeChild(this.cutoutSVGElement), this.cutoutSVGElement = void 0;
  }
  updateCutoutPosition(t) {
    const e = {
      hightlightBox: t.hightlightBox,
      padding: t.padding,
      opacity: this.options.opacity,
      radius: t.radius,
      animated: this.options.animate,
      fillColor: this.options.overlayColor
    };
    if (!this.cutoutSVGElement)
      this.mountCutoutElement(e);
    else {
      const i = this.cutoutSVGElement.firstElementChild;
      if ((i == null ? void 0 : i.tagName) === "path")
        i.setAttribute(
          "d",
          k(e)
        );
      else
        throw new Error("No existing path found on SVG but we want one :(");
    }
  }
}
const T = ["top", "bottom", "left", "right"];
class Z {
  constructor(t, e, i, n) {
    a(this, "highlightElement");
    a(this, "popover");
    a(this, "padding");
    a(this, "finalOffset");
    this.highlightElement = t, this.popover = e, this.padding = i, this.finalOffset = i + n;
  }
  setBestPosition(t, e) {
    var o;
    const i = this.findOptimalPosition(t, e), n = (o = this.popover.getPopoverElements()) == null ? void 0 : o.popoverWrapper;
    d(n), n.style.left = typeof i.left == "number" ? `${i.left}px` : "auto", n.style.right = typeof i.right == "number" ? `${i.right}px` : "auto", n.style.top = typeof i.top == "number" ? `${i.top}px` : "auto", n.style.bottom = typeof i.bottom == "number" ? `${i.bottom}px` : "auto";
  }
  getHighlightElemRect() {
    return this.highlightElement.getDOMRect();
  }
  getPopoverDimensions() {
    const t = this.popover.getPopoverElements(), e = t == null ? void 0 : t.popoverWrapper.getBoundingClientRect(), i = t == null ? void 0 : t.popoverTip.getBoundingClientRect();
    return d(e), d(i), {
      width: e.width + this.finalOffset,
      height: e.height + this.finalOffset,
      tipSize: i.width
    };
  }
  checkIfSideOptimal(t) {
    const e = this.getPopoverDimensions(), i = this.getHighlightElemRect();
    switch (t) {
      case "top":
        const n = i.top - e.height;
        return {
          side: "top",
          value: n,
          isOptimal: n >= 0
        };
      case "bottom":
        const o = window.innerHeight - (i.bottom + e.height);
        return {
          side: "bottom",
          value: o,
          isOptimal: o >= 0
        };
      case "left":
        const h = i.left - e.width;
        return {
          side: "left",
          value: h,
          isOptimal: h >= 0
        };
      case "right":
        const r = window.innerWidth - (i.right + e.width);
        return {
          side: "right",
          value: r,
          isOptimal: r >= 0
        };
    }
  }
  findOptimalSide(t = 0) {
    const e = T[t], i = this.checkIfSideOptimal(e);
    return i.isOptimal ? i : t === T.length - 1 ? "none" : this.findOptimalSide(t + 1);
  }
  normalizeAlignment(t, e, i, n, o, h) {
    switch (t) {
      case "start":
        return Math.max(
          Math.min(i - this.padding, n - e - h),
          h
        );
      case "end":
        return Math.max(
          Math.min(
            i - e + o + this.padding,
            n - e - h
          ),
          h
        );
      case "center":
        const r = i - e / 2 + o / 2;
        return Math.min(
          Math.max(h, r),
          n - h - e
        );
    }
  }
  findOptimalPosition(t, e) {
    let i;
    if (e ? (i = this.checkIfSideOptimal(e), i.isOptimal || (i = this.findOptimalSide())) : i = this.findOptimalSide(), i === "none") {
      const n = this.getPopoverDimensions();
      return this.clearPopoverTipPosition(), {
        left: window.innerWidth / 2 - (n.width - this.finalOffset) / 2,
        bottom: 10
      };
    } else {
      const n = this.getPopoverDimensions(), o = this.getHighlightElemRect(), h = {}, r = n.width - this.finalOffset, s = n.height - this.finalOffset;
      switch (i.side) {
        case "top":
          h.top = Math.min(
            i.value,
            window.innerHeight - s - n.tipSize
          ), h.left = this.normalizeAlignment(
            t,
            r,
            o.left,
            window.innerWidth,
            o.width,
            n.tipSize
          ), this.setPopoverTipPosition(
            t,
            i.side,
            o.left,
            o.width
          );
          break;
        case "bottom":
          h.bottom = Math.min(
            i.value,
            window.innerHeight - s - n.tipSize
          ), h.left = this.normalizeAlignment(
            t,
            r,
            o.left,
            window.innerWidth,
            o.width,
            n.tipSize
          ), this.setPopoverTipPosition(
            t,
            i.side,
            o.left,
            o.width
          );
          break;
        case "left":
          h.left = Math.min(
            i.value,
            window.innerWidth - r - n.tipSize
          ), h.top = this.normalizeAlignment(
            t,
            s,
            o.top,
            window.innerHeight,
            o.height,
            n.tipSize
          ), this.setPopoverTipPosition(
            t,
            i.side,
            o.top,
            o.height
          );
          break;
        case "right":
          h.right = Math.min(
            i.value,
            window.innerWidth - r - n.tipSize
          ), h.top = this.normalizeAlignment(
            t,
            s,
            o.top,
            window.innerHeight,
            o.height,
            n.tipSize
          ), this.setPopoverTipPosition(
            t,
            i.side,
            o.top,
            o.height
          );
          break;
      }
      return h;
    }
  }
  clearPopoverTipPosition() {
    var e;
    const t = (e = this.popover.getPopoverElements()) == null ? void 0 : e.popoverTip;
    d(t), t.className = R;
  }
  setPopoverTipPosition(t, e, i, n) {
    var c, u;
    const o = (c = this.popover.getPopoverElements()) == null ? void 0 : c.popoverWrapper, h = (u = this.popover.getPopoverElements()) == null ? void 0 : u.popoverTip;
    d(o), d(h);
    let r = e, s = t;
    const l = o.getBoundingClientRect();
    switch (e) {
      case "top":
        i + n <= 0 ? (r = "right", s = "end") : i + n - l.width <= 0 && (s = "start"), i >= window.innerWidth ? (r = "left", s = "end") : i + l.width >= window.innerWidth && (s = "end");
        break;
      case "bottom":
        i + n <= 0 ? (r = "right", s = "start") : i + n - l.width <= 0 && (s = "start"), i >= window.innerWidth ? (r = "left", s = "start") : i + l.width >= window.innerWidth && (s = "end");
        break;
      case "left":
        i + n <= 0 ? (r = "bottom", s = "end") : i + n - l.height <= 0 && (s = "start"), i >= window.innerHeight ? (r = "top", s = "end") : i + l.height >= window.innerHeight && (s = "end");
        break;
      case "right":
        i + n <= 0 ? (r = "bottom", s = "start") : i + n - l.height <= 0 && (s = "start"), i >= window.innerHeight ? (r = "top", s = "start") : i + l.height >= window.innerHeight && (s = "end");
        break;
    }
    this.clearPopoverTipPosition(), h.classList.add(
      `boarding-tipside-${r}`,
      `boarding-tipalign-${s}`
    );
  }
}
class tt {
  constructor({
    showButtons: t = !0,
    disableButtons: e = [],
    offset: i = 10,
    alignment: n = "start",
    closeBtnText: o = "Close",
    doneBtnText: h = "Done",
    startBtnText: r = "Next &rarr;",
    nextBtnText: s = "Next &rarr;",
    prevBtnText: l = "&larr; Previous",
    ...c
  }) {
    a(this, "options");
    a(this, "popover");
    a(this, "highlightElement");
    this.options = {
      showButtons: t,
      disableButtons: e,
      offset: i,
      alignment: n,
      closeBtnText: o,
      doneBtnText: h,
      startBtnText: r,
      nextBtnText: s,
      prevBtnText: l,
      ...c
    };
  }
  hide() {
    var t;
    !this.popover || (t = this.popover.popoverWrapper.parentElement) == null || t.removeChild(
      this.popover.popoverWrapper
    );
  }
  show(t) {
    this.highlightElement = t, this.attachNode(), d(this.popover), d(this.highlightElement), this.setInitialState(), this.popover.popoverTitle.innerHTML = this.options.title || "", this.popover.popoverDescription.innerHTML = this.options.description || "", this.renderFooter(), this.setPosition(), this.options.scrollIntoViewOptions !== "no-scroll" && x(
      this.popover.popoverWrapper,
      this.options.scrollIntoViewOptions
    );
  }
  refresh() {
    !this.highlightElement || this.setPosition();
  }
  getPopoverElements() {
    return this.popover;
  }
  getShowButtons() {
    return this.options.showButtons;
  }
  getDisabledButtons() {
    return this.options.disableButtons;
  }
  setInitialState() {
    d(this.popover), this.popover.popoverWrapper.style.display = "block", this.popover.popoverWrapper.style.left = "0", this.popover.popoverWrapper.style.top = "0", this.popover.popoverWrapper.style.bottom = "", this.popover.popoverWrapper.style.right = "";
  }
  setPosition() {
    d(this.highlightElement);
    const t = this.highlightElement.getCustomPadding();
    new Z(
      this.highlightElement,
      this,
      v(this.options.padding, t),
      this.options.offset
    ).setBestPosition(this.options.alignment, this.options.prefferedSide);
  }
  attachNode() {
    var c, u, g;
    this.popover && ((c = this.popover.popoverWrapper.parentElement) == null || c.removeChild(
      this.popover.popoverWrapper
    ));
    const t = z(this.options.className), {
      popoverWrapper: e,
      popoverTip: i,
      popoverTitle: n,
      popoverDescription: o,
      popoverFooter: h,
      popoverPrevBtn: r,
      popoverNextBtn: s,
      popoverCloseBtn: l
    } = t;
    this.options.animate && e.classList.add(`${L}-animated`), (g = (u = this.options).onPopoverRender) == null || g.call(u, t), document.body.appendChild(e), H(
      e,
      (f) => {
        const E = f.target;
        s.contains(E) && this.options.onNextClick(), r.contains(E) && this.options.onPreviousClick(), l.contains(E) && this.options.onCloseClick();
      },
      (f) => !o.contains(f)
    ), this.popover = {
      popoverWrapper: e,
      popoverTip: i,
      popoverTitle: n,
      popoverDescription: o,
      popoverFooter: h,
      popoverPrevBtn: r,
      popoverNextBtn: s,
      popoverCloseBtn: l
    };
  }
  renderFooter() {
    d(this.popover), this.popover.popoverNextBtn.innerHTML = this.options.nextBtnText, this.popover.popoverPrevBtn.innerHTML = this.options.prevBtnText, this.popover.popoverCloseBtn.innerHTML = this.options.closeBtnText;
    const t = this.options.totalCount && this.options.totalCount !== 1;
    if (!this.options.showButtons) {
      this.popover.popoverFooter.classList.add(U), this.popover.popoverFooter.style.display = "none";
      return;
    }
    t ? (this.popover.popoverNextBtn.style.display = "inline-block", this.popover.popoverPrevBtn.style.display = "inline-block", this.popover.popoverCloseBtn.classList.remove(y)) : (this.popover.popoverNextBtn.style.display = "none", this.popover.popoverPrevBtn.style.display = "none", this.popover.popoverCloseBtn.classList.add(y)), Array.isArray(this.options.showButtons) && (this.options.showButtons.includes("next") || (this.popover.popoverNextBtn.style.display = "none"), this.options.showButtons.includes("previous") || (this.popover.popoverPrevBtn.style.display = "none"), this.options.showButtons.includes("close") || (this.popover.popoverCloseBtn.style.display = "none")), this.popover.popoverFooter.style.display = "block", this.options.isFirst ? (this.popover.popoverPrevBtn.classList.add(w), this.popover.popoverNextBtn.innerHTML = this.options.startBtnText) : this.popover.popoverPrevBtn.classList.remove(w), this.options.disableButtons.includes("close") && this.popover.popoverCloseBtn.classList.add(w), this.options.disableButtons.includes("previous") && this.popover.popoverPrevBtn.classList.add(w), this.options.disableButtons.includes("next") && this.popover.popoverNextBtn.classList.add(w), this.options.isLast ? this.popover.popoverNextBtn.innerHTML = this.options.doneBtnText : this.popover.popoverNextBtn.innerHTML = this.options.nextBtnText;
  }
}
class et {
  constructor({
    options: t,
    highlightDomElement: e,
    popover: i
  }) {
    a(this, "options");
    a(this, "highlightDomElement");
    a(this, "popover");
    a(this, "lastKnownDomRect");
    this.highlightDomElement = e, this.options = t, this.popover = i;
  }
  isSame(t) {
    return !t || !t.highlightDomElement ? !1 : t.highlightDomElement === this.highlightDomElement;
  }
  getElement() {
    return this.highlightDomElement;
  }
  getPopover() {
    return this.popover;
  }
  getStrictClickHandling() {
    return this.options.strictClickHandling;
  }
  onDeselected() {
    var t, e, i;
    (t = this.popover) == null || t.hide(), this.getElement().classList.remove(b), (i = (e = this.options).onDeselected) == null || i.call(e, this);
  }
  onBeforeHighlighted() {
    var t, e;
    (e = (t = this.options).onBeforeHighlighted) == null || e.call(t, this);
  }
  onHighlighted() {
    var t, e, i;
    this.options.scrollIntoViewOptions !== "no-scroll" && x(this.highlightDomElement, this.options.scrollIntoViewOptions), (t = this.popover) == null || t.show(this), this.getElement().classList.add(b), (i = (e = this.options).onHighlighted) == null || i.call(e, this);
  }
  getCustomPadding() {
    return this.options.padding;
  }
  getCustomRadius() {
    return this.options.radius;
  }
  onNext() {
    var t, e;
    (e = (t = this.options).onNext) == null || e.call(t, this);
  }
  onPrevious() {
    var t, e;
    (e = (t = this.options).onPrevious) == null || e.call(t, this);
  }
  getDOMRect() {
    var n, o;
    const t = (o = (n = this.popover) == null ? void 0 : n.getPopoverElements()) == null ? void 0 : o.popoverWrapper, e = this.getElement(), i = e.getBoundingClientRect();
    return e.isConnected ? (t == null || t.classList.remove(B), this.lastKnownDomRect = i, i) : (t == null || t.classList.add(B), this.lastKnownDomRect || i);
  }
}
class ot {
  constructor(t) {
    a(this, "isActivated");
    a(this, "currentStep");
    a(this, "options");
    a(this, "steps");
    a(this, "lastMovementRequested");
    a(this, "currentMovePrevented");
    a(this, "overlay");
    const {
      strictClickHandling: e = !0,
      animate: i = !0,
      padding: n = 10,
      radius: o = 5,
      scrollIntoViewOptions: h = {
        behavior: "auto",
        block: "center"
      },
      allowClose: r = !0,
      keyboardControl: s = !0,
      overlayClickNext: l = !1,
      ...c
    } = { ...t };
    this.options = {
      strictClickHandling: e,
      animate: i,
      padding: n,
      radius: o,
      scrollIntoViewOptions: h,
      allowClose: r,
      keyboardControl: s,
      overlayClickNext: l,
      ...c
    }, this.isActivated = !1, this.steps = [], this.currentStep = 0, this.currentMovePrevented = !1, this.overlay = new Q({
      animate: this.options.animate,
      padding: this.options.padding,
      radius: this.options.radius,
      onReset: this.options.onReset,
      opacity: this.options.opacity,
      overlayColor: this.options.overlayColor,
      onOverlayClick: () => {
        if (this.options.overlayClickNext) {
          this.next();
          return;
        }
        if (this.options.allowClose) {
          this.reset(!1, "cancel");
          return;
        }
      }
    }), this.onKeyUp = this.onKeyUp.bind(this), this.onClick = this.onClick.bind(this);
  }
  start(t = 0) {
    var e, i;
    if (this.lastMovementRequested = {
      movement: 0,
      index: t
    }, !this.steps || this.steps.length === 0)
      throw new Error("There are no steps defined to iterate");
    (i = (e = this.steps[t]).prepareElement) == null || i.call(e, "init"), !this.currentMovePrevented && this.handleStart(t);
  }
  highlight(t) {
    var i;
    this.lastMovementRequested = {
      movement: 1,
      selector: t
    };
    const e = typeof t == "object" && "element" in t ? t : { element: t };
    (i = e.prepareElement) == null || i.call(e, "init"), !this.currentMovePrevented && this.handleHighlight(t);
  }
  preventMove() {
    if (this.lastMovementRequested !== void 0)
      if (this.currentMovePrevented !== this.lastMovementRequested)
        if (this.currentMovePrevented)
          console.warn(
            "Tried to call Boarding.preventMove, but move has already been prevented, and not been continued or reset yet"
          );
        else {
          const t = { ...this.lastMovementRequested };
          this.currentMovePrevented = t, this.lastMovementRequested = t;
        }
      else
        console.warn(
          "Boarding.preventMove was called multiple times for the same move, which has no effect."
        );
    else
      console.warn(
        "Tried to call Boarding.preventMove before, but no move was requested so far."
      );
  }
  async continue() {
    setTimeout(() => {
      if (this.currentMovePrevented === this.lastMovementRequested)
        switch (this.currentMovePrevented = !1, this.lastMovementRequested.movement) {
          case 0:
            this.handleStart(this.lastMovementRequested.index);
            break;
          case 1:
            this.handleHighlight(this.lastMovementRequested.selector);
            break;
          case 2:
            this.handleNext();
            break;
          case 3:
            this.moveNext();
            break;
          case 4:
            this.handlePrevious();
            break;
          case 5:
            this.movePrevious();
            break;
        }
      else
        console.warn(
          "Boarding.continue was probably called too late, since the last preventMove was called from a different step (or never called at all)."
        );
    }, 0);
  }
  clearMovePrevented() {
    this.currentMovePrevented = !1;
  }
  next() {
    var t, e;
    this.currentMovePrevented || (this.lastMovementRequested = {
      movement: 2,
      index: this.currentStep
    }, (e = (t = this.steps[this.currentStep + 1]) == null ? void 0 : t.prepareElement) == null || e.call(t, "next"), !this.currentMovePrevented && this.handleNext());
  }
  previous() {
    var t, e;
    this.currentMovePrevented || (this.lastMovementRequested = {
      movement: 4,
      index: this.currentStep
    }, (e = (t = this.steps[this.currentStep - 1]) == null ? void 0 : t.prepareElement) == null || e.call(t, "prev"), !this.currentMovePrevented && this.handlePrevious());
  }
  hasNextStep() {
    return !!this.steps[this.currentStep + 1];
  }
  hasPreviousStep() {
    return !!this.steps[this.currentStep - 1];
  }
  reset(t = !1, e = "cancel") {
    this.currentStep = 0, this.isActivated = !1, this.overlay.clear(t, e), this.removeEventListeners(), document.body.classList.remove(
      C,
      S
    ), this.lastMovementRequested = void 0, this.currentMovePrevented = !1;
  }
  hasHighlightedElement() {
    return !!this.overlay.currentHighlightedElement;
  }
  getHighlightedElement() {
    return this.overlay.currentHighlightedElement;
  }
  getLastHighlightedElement() {
    return this.overlay.previouslyHighlightedElement;
  }
  defineSteps(t) {
    this.steps = t;
  }
  getSteps() {
    return this.steps;
  }
  handleStart(t) {
    var i, n;
    const e = this.prepareElementFromStep(t);
    if (!e)
      throw new Error(
        `The step with starting index ${t} could not resolve to an element.`
      );
    this.currentStep = t, (n = (i = this.options).onStart) == null || n.call(i, e), this.activateBoarding(e);
  }
  handleHighlight(t) {
    const e = typeof t == "object" && "element" in t ? t : { element: t }, i = this.prepareElementFromStep(e);
    !i || this.activateBoarding(i);
  }
  handleNext() {
    this.lastMovementRequested = {
      movement: 3,
      index: this.currentStep
    };
    const t = this.prepareElementFromStep(this.currentStep);
    t == null || t.onNext(), !this.currentMovePrevented && this.moveNext();
  }
  handlePrevious() {
    this.lastMovementRequested = {
      movement: 5,
      index: this.currentStep
    };
    const t = this.prepareElementFromStep(this.currentStep);
    t == null || t.onPrevious(), !this.currentMovePrevented && this.movePrevious();
  }
  moveNext() {
    const t = this.prepareElementFromStep(this.currentStep + 1);
    if (!t) {
      const e = !this.hasNextStep();
      this.reset(!1, e ? "finish" : "cancel");
      return;
    }
    this.setStrictClickHandlingRules(t), this.overlay.highlight(t), this.currentStep += 1;
  }
  movePrevious() {
    const t = this.prepareElementFromStep(this.currentStep - 1);
    if (!t) {
      this.reset(!1, "cancel");
      return;
    }
    this.setStrictClickHandlingRules(t), this.overlay.highlight(t), this.currentStep -= 1;
  }
  activateBoarding(t) {
    this.attachEventListeners(), this.isActivated = !0, this.setStrictClickHandlingRules(t), this.overlay.highlight(t);
  }
  setStrictClickHandlingRules(t) {
    const e = t.getStrictClickHandling(), i = e === void 0 ? this.options.strictClickHandling : e;
    document.body.classList.remove(
      C,
      S
    ), i === "block-all" ? document.body.classList.add(C) : i && document.body.classList.add(S);
  }
  attachEventListeners() {
    window.addEventListener("keyup", this.onKeyUp, !1), "ontouchstart" in document.documentElement ? window.addEventListener("touchstart", this.onClick, !1) : window.addEventListener("click", this.onClick, !1);
  }
  removeEventListeners() {
    window.removeEventListener("keyup", this.onKeyUp, !1), window.removeEventListener("click", this.onClick, !1), window.removeEventListener("touchstart", this.onClick, !1);
  }
  onClick(t) {
    if (!this.overlay.currentHighlightedElement)
      return;
    X(t.target);
    const n = !this.overlay.currentHighlightedElement.getElement().contains(t.target);
    if (this.options.strictClickHandling && n) {
      t.preventDefault(), t.stopImmediatePropagation(), t.stopPropagation();
      return;
    }
  }
  onKeyUp(t) {
    if (!this.isActivated || !this.options.keyboardControl)
      return;
    if (t.key === "Escape" && this.options.allowClose) {
      this.reset(!1, "cancel");
      return;
    }
    const e = this.getHighlightedElement(), i = e == null ? void 0 : e.getPopover(), n = i == null ? void 0 : i.getShowButtons(), o = i == null ? void 0 : i.getDisabledButtons();
    !n || (t.key === "ArrowRight" ? !(o != null && o.includes("next")) && (n === !0 || n.includes("next")) && this.next() : t.key === "ArrowLeft" && !(o != null && o.includes("previous")) && (n === !0 || n.includes("previous")) && this.previous());
  }
  prepareElementFromStep(t) {
    var r;
    const e = typeof t == "number" ? this.steps[t] : t, i = typeof t == "number" ? t : 0, n = typeof t == "number" ? this.steps.length : 1;
    if (e === void 0)
      return null;
    const o = typeof e.element == "string" ? document.querySelector(e.element) : e.element;
    if (!o)
      return console.warn(`Element to highlight ${e.element} not found`), null;
    let h = null;
    if ((r = e.popover) != null && r.title) {
      const s = [
        this.options.className,
        e.popover.className
      ].filter((l) => l).join(" ");
      h = new tt({
        padding: this.options.padding,
        offset: this.options.offset,
        animate: this.options.animate,
        scrollIntoViewOptions: e.scrollIntoViewOptions === void 0 ? this.options.scrollIntoViewOptions : e.scrollIntoViewOptions,
        title: e.popover.title,
        description: e.popover.description,
        prefferedSide: e.popover.prefferedSide || this.options.prefferedSide,
        alignment: e.popover.alignment || this.options.alignment,
        showButtons: e.popover.showButtons === void 0 ? this.options.showButtons : e.popover.showButtons,
        disableButtons: e.popover.disableButtons === void 0 ? this.options.disableButtons : e.popover.disableButtons,
        onPopoverRender: e.popover.onPopoverRender === void 0 ? this.options.onPopoverRender : e.popover.onPopoverRender,
        doneBtnText: e.popover.doneBtnText || this.options.doneBtnText,
        closeBtnText: e.popover.closeBtnText || this.options.closeBtnText,
        nextBtnText: e.popover.nextBtnText || this.options.nextBtnText,
        startBtnText: e.popover.startBtnText || this.options.startBtnText,
        prevBtnText: e.popover.prevBtnText || this.options.prevBtnText,
        className: s,
        totalCount: n,
        currentIndex: i,
        isFirst: i === 0,
        isLast: n === 0 || i === n - 1,
        onNextClick: () => {
          this.next();
        },
        onPreviousClick: () => {
          this.previous();
        },
        onCloseClick: () => {
          this.reset(!1, "cancel");
        }
      });
    }
    return new et({
      highlightDomElement: o,
      options: {
        scrollIntoViewOptions: e.scrollIntoViewOptions === void 0 ? this.options.scrollIntoViewOptions : e.scrollIntoViewOptions,
        onBeforeHighlighted: e.onBeforeHighlighted || this.options.onBeforeHighlighted,
        onHighlighted: e.onHighlighted || this.options.onHighlighted,
        onDeselected: e.onDeselected || this.options.onDeselected,
        onNext: e.onNext || this.options.onNext,
        onPrevious: e.onPrevious || this.options.onPrevious,
        strictClickHandling: e.strictClickHandling,
        padding: e.padding,
        radius: e.radius
      },
      popover: h
    });
  }
}
export {
  ot as Boarding
};
