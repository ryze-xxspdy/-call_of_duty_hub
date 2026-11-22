/* ---------- Tiny JSX runtime ----------
   Lets .tsx files write <div className="x" onClick={fn}>…</div> and get real DOM elements back,
   with no React and no bundler. tsc compiles JSX to h(...) calls (see tsconfig.json). */

type Child = Node | string | number | boolean | null | undefined | Child[];
type Props = Record<string, any> | null;
type Component = (props: Record<string, any>) => Node;

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "line", "g", "polyline", "polygon", "ellipse", "text"]);

function append(parent: Node, child: Child): void {
  if (child === null || child === undefined || child === false || child === true) return;
  if (Array.isArray(child)) { child.forEach((c) => append(parent, c)); return; }
  parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
}

function Fragment(props: { children?: Child }): DocumentFragment {
  const frag = document.createDocumentFragment();
  append(frag, props && props.children);
  return frag;
}

function h(tag: string | Component | typeof Fragment, props: Props, ...children: Child[]): Node {
  if (typeof tag === "function") return (tag as Component)({ ...(props || {}), children });

  const svg = SVG_TAGS.has(tag as string);
  const el: Element = svg ? document.createElementNS(SVG_NS, tag as string) : document.createElement(tag as string);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "ref") { (value as (e: Element) => void)(el); continue; }
    if (key === "className") { el.setAttribute("class", String(value)); continue; }
    if (key === "htmlFor") { el.setAttribute("for", String(value)); continue; }
    if (key === "style" && typeof value === "object") { Object.assign((el as HTMLElement).style, value); continue; }
    if (key === "dangerouslySetInnerHTML") { el.innerHTML = String(value); continue; }
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      continue;
    }
    if (key === "value" || key === "checked" || key === "disabled") { (el as any)[key] = value; continue; }
    el.setAttribute(key, value === true ? "" : String(value));
  }
  children.forEach((c) => append(el, c));
  return el;
}

/** Turn a trusted HTML string (e.g. from Utils.avatar) into nodes that can be used as a JSX child. */
function raw(html: string): DocumentFragment {
  const t = document.createElement("template");
  t.innerHTML = html;
  return t.content;
}

/** Replace everything inside `target` with `content`. */
function mountInto(target: Element, ...content: Child[]): void {
  target.replaceChildren();
  content.forEach((c) => append(target, c));
}

declare namespace JSX {
  type Element = Node;
  interface IntrinsicElements { [tag: string]: any }
  interface ElementChildrenAttribute { children: {} }
}
