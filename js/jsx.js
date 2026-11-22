"use strict";
/* ---------- Tiny JSX runtime ----------
   Lets .tsx files write <div className="x" onClick={fn}>…</div> and get real DOM elements back,
   with no React and no bundler. tsc compiles JSX to h(...) calls (see tsconfig.json). */
const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "line", "g", "polyline", "polygon", "ellipse", "text"]);
function append(parent, child) {
    if (child === null || child === undefined || child === false || child === true)
        return;
    if (Array.isArray(child)) {
        child.forEach((c) => append(parent, c));
        return;
    }
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
}
function Fragment(props) {
    const frag = document.createDocumentFragment();
    append(frag, props && props.children);
    return frag;
}
function h(tag, props, ...children) {
    if (typeof tag === "function")
        return tag({ ...(props || {}), children });
    const svg = SVG_TAGS.has(tag);
    const el = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value === null || value === undefined || value === false)
            continue;
        if (key === "ref") {
            value(el);
            continue;
        }
        if (key === "className") {
            el.setAttribute("class", String(value));
            continue;
        }
        if (key === "htmlFor") {
            el.setAttribute("for", String(value));
            continue;
        }
        if (key === "style" && typeof value === "object") {
            Object.assign(el.style, value);
            continue;
        }
        if (key === "dangerouslySetInnerHTML") {
            el.innerHTML = String(value);
            continue;
        }
        if (key.startsWith("on") && typeof value === "function") {
            el.addEventListener(key.slice(2).toLowerCase(), value);
            continue;
        }
        if (key === "value" || key === "checked" || key === "disabled") {
            el[key] = value;
            continue;
        }
        el.setAttribute(key, value === true ? "" : String(value));
    }
    children.forEach((c) => append(el, c));
    return el;
}
/** Turn a trusted HTML string (e.g. from Utils.avatar) into nodes that can be used as a JSX child. */
function raw(html) {
    const t = document.createElement("template");
    t.innerHTML = html;
    return t.content;
}
/** Replace everything inside `target` with `content`. */
function mountInto(target, ...content) {
    target.replaceChildren();
    content.forEach((c) => append(target, c));
}
