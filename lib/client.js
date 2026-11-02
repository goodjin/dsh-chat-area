window.__ModuleLoader__.load({id:`@goodjin2/dsh-chat-area`,factory:e=>{var t={exports:{}},n=t.exports,r=Object.create,i=Object.defineProperty,a=Object.getOwnPropertyDescriptor,o=Object.getOwnPropertyNames,s=Object.getPrototypeOf,c=Object.prototype.hasOwnProperty,l=(e,t,n,r)=>{if(t&&typeof t==`object`||typeof t==`function`)for(var s=o(t),l=0,u=s.length,d;l<u;l++)d=s[l],!c.call(e,d)&&d!==n&&i(e,d,{get:(e=>t[e]).bind(null,d),enumerable:!(r=a(t,d))||r.enumerable});return e},u=(e,t,n)=>(n=e==null?{}:r(s(e)),l(t||!e||!e.__esModule?i(n,`default`,{value:e,enumerable:!0}):n,e));let d=e(`react`);d=u(d);let f=`conversation.session.header.utilities`;function p(e){return e.replace(/^session-/,``).slice(0,8)}function m(e){let t=e.sessionId,n=p(t);return(0,d.createElement)(`div`,{"data-session-id-bar":``,title:t,style:{display:`inline-flex`,alignItems:`center`,gap:`6px`,fontSize:`12px`,opacity:.75}},(0,d.createElement)(`code`,{"data-session-id-short":``,style:{fontFamily:`var(--dsw-font-family-mono, monospace)`}},n),(0,d.createElement)(`button`,{type:`button`,"data-session-id-copy":``,title:e.copied?`已复制`:`复制完整会话 ID`,"aria-label":e.copied?`已复制`:`复制完整会话 ID`,onClick:e.onCopy,style:{border:`none`,background:`transparent`,cursor:`pointer`,padding:`2px 4px`,borderRadius:`4px`,fontSize:`12px`,color:`inherit`}},e.copied?`已复制`:`复制`))}function h(e){let[t,n]=(0,d.useState)(!1),r=typeof e?.sessionId==`string`&&e.sessionId!==``?e.sessionId:void 0;return r===void 0?null:m({sessionId:r,copied:t,onCopy:()=>{let e=typeof navigator>`u`?void 0:navigator.clipboard;e!==void 0&&e.writeText(r).then(()=>{n(!0),setTimeout(()=>{n(!1)},1500)},()=>{})}})}function g(e){return e.inject(f,()=>e.register({name:f,id:`threadharbor-session-id`,order:20},h))}let _={"mermaid.label":`Mermaid`,"mermaid.diagram":`图表`,"mermaid.source":`源码`,"mermaid.toggleNamed":`切换 Mermaid 图与源码`};function v(e,t){return t===void 0?e:e.replace(/\{(\w+)\}/g,(e,n)=>String(t[n]??`{${n}}`))}let y=(e,t)=>v(_[e]??e,t),b=`/threadharbor/mermaid.js`,x=`th-mermaid-style`,S=`.md-code-block`,C=`data-th-mermaid`,w=`data-th-mermaid-canvas`,T=`data-th-mermaid-toggle`,E=`data-th-mermaid-active`,D=`data-th-mermaid-view`,O=`
[${C}] {
  border-top: 1px solid rgba(128, 128, 128, 0.28);
  padding: 6px 10px 8px;
}
[${C}] [data-th-mermaid-head] {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.4;
  opacity: 0.85;
}
[${C}] [data-th-mermaid-label] {
  font-weight: 600;
  letter-spacing: 0.02em;
}
[${C}] [${T}] {
  margin-left: auto;
  padding: 1px 8px;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  opacity: 0.8;
}
[${C}] [${T}]:hover {
  opacity: 1;
}
[${C}] [${w}] {
  display: none;
  overflow: auto;
  padding: 8px 0 4px;
}
${S}[${D}="diagram"] > [${C}] > [${w}] {
  display: block;
}
${S}[${D}="diagram"] > [data-code-block-content] {
  display: none;
}
[${C}] [${w}] svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}
`,k=/^(?:graph|flowchart)\s+(?:TB|TD|BT|RL|LR)\b/i,A=RegExp(`^(?:sequenceDiagram\\b|classDiagram(?:-v2)?\\b|stateDiagram(?:-v2)?\\b|erDiagram\\b|journey\\b|gantt\\b|pie(?:\\s|$)|quadrantChart\\b|requirementDiagram\\b|gitGraph\\b|mindmap\\b|timeline\\b|C4(?:Context|Container|Component|Dynamic|Deployment)\\b|sankey-beta\\b|xychart-beta\\b|block-beta\\b|architecture-beta\\b|packet-beta\\b|kanban\\b|radar(?:-beta)?\\b|treemap(?:-beta)?\\b|zenuml\\b)`);function j(e){let t=e.replace(/^\uFEFF/,``),n=t;if(n.startsWith(`---`)){let e=n.indexOf(`
---`,3);e!==-1&&(n=n.slice(e+4))}for(;;){let e=n.replace(/^\s+/,``);if(e.startsWith(`%%{`)){let t=e.indexOf(`}%%`);if(t===-1)return;n=e.slice(t+3);continue}if(e.startsWith(`%%`)){let t=e.indexOf(`
`);if(t===-1)return;n=e.slice(t+1);continue}n=e;break}let r=n.split(`
`,1)[0]?.trim()??``;return r!==``&&(k.test(r)||A.test(r))?t:void 0}function M(e,t){let n=e.querySelector(`base[href]`)?.getAttribute(`href`)??``;if(n!==``)try{let e=new URL(n,t.location.href);return e.pathname.endsWith(`/`)||(e.pathname+=`/`),new URL(b.replace(/^\//,``),e).href}catch{}return new URL(b,t.location.origin).href}let N=(e,t)=>{let n=t.mermaid;return P(n)?Promise.resolve(n):new Promise((n,r)=>{let i=e.createElement(`script`);i.src=M(e,t),i.async=!0,i.addEventListener(`load`,()=>{let e=t.mermaid;P(e)?n(e):r(Error(`${i.src} loaded but did not expose the mermaid API`))}),i.addEventListener(`error`,()=>{r(Error(`${i.src} could not be loaded`))}),e.head.appendChild(i)})};function P(e){if(typeof e!=`object`||!e)return!1;let t=e;return typeof t.initialize==`function`&&typeof t.render==`function`}let F=!1,I=0;function L(e={}){let t=e.document??(typeof document>`u`?void 0:document),n=e.window??t?.defaultView??(typeof window>`u`?void 0:window);if(t===void 0||n===void 0||F)return{scan:()=>{},dispose:()=>{}};F=!0;let r=e.log??(()=>{}),i=e.t??y,a=e.scanDelayMs??150,o=e.settleMs??350,s=new Map,c=new Map,l=new Set,u=!1,d,f,p,m,h,g=Promise.resolve(),_=e=>{l.has(e)||(l.add(e),r(e))};if(t.getElementById(x)===null){let e=t.createElement(`style`);e.id=x,e.textContent=O,t.head.appendChild(e)}let v=()=>t.body?.hasAttribute(`data-ds-dark-theme`)===!0?`dark`:`default`,b=()=>(h??=(e.loadApi??N)(t,n),h),k=(e,t)=>`${e}\u0000${t}`,A=(e,t)=>{for(c.has(e)&&c.delete(e),c.set(e,t);c.size>64;){let e=c.keys().next().value;if(e===void 0)break;c.delete(e)}},M=(e,r)=>{if(m===r)return;m=r;let i=t.body,a=i===null?``:n.getComputedStyle(i).fontFamily;e.initialize({startOnLoad:!1,securityLevel:`strict`,suppressErrorRendering:!0,theme:r,logLevel:`fatal`,...a===``?{}:{fontFamily:a}})},P=e=>{let t=g.then(e,e);return g=t.catch(()=>{}),t},L=(e,t,n)=>{t.view=n,e.setAttribute(D,n);let r=t.preview?.querySelector(`[${T}]`);r!=null&&(r.textContent=i(n===`diagram`?`mermaid.source`:`mermaid.diagram`),r.setAttribute(`aria-pressed`,n===`diagram`?`true`:`false`),r.setAttribute(`aria-label`,i(`mermaid.toggleNamed`)))},z=(e,n)=>{if(n.preview!==void 0)if(!n.preview.isConnected)n.preview=void 0;else{let e=n.preview.querySelector(`[${w}]`),t=n.preview.querySelector(`[${T}]`);if(e!==null&&t!==null)return{canvas:e,button:t};n.preview.remove(),n.preview=void 0}let r=t.createElement(`div`);r.setAttribute(C,``),r.addEventListener(`dblclick`,e=>{e.stopPropagation()});let a=t.createElement(`div`);a.setAttribute(`data-th-mermaid-head`,``);let o=t.createElement(`span`);o.setAttribute(`data-th-mermaid-label`,``),o.textContent=i(`mermaid.label`);let s=t.createElement(`button`);s.type=`button`,s.setAttribute(T,``),s.addEventListener(`click`,t=>{t.preventDefault(),t.stopPropagation(),L(e,n,n.view===`diagram`?`source`:`diagram`)}),a.append(o,s);let c=t.createElement(`div`);return c.setAttribute(w,``),r.append(a,c),e.appendChild(r),n.preview=r,{canvas:c,button:s}},B=(e,t,n,r)=>{let{canvas:i}=z(e,t);i.innerHTML=r,t.svg=r,e.setAttribute(E,``),L(e,t,n)},V=(e,t)=>{t.svg=void 0,t.view=`source`,t.preview?.remove(),t.preview=void 0,e.removeAttribute(E),e.removeAttribute(D)},H=(e,t)=>{t.generation+=1,t.attempted=void 0,V(e,t)},U=async(e,t)=>{let n=t.source;if(u||!e.isConnected||j(n)===void 0||t.attempted===n)return;let r=v(),i=++t.generation;t.attempted=n;let a=k(r,n),o=c.get(a);if(o!==void 0){B(e,t,t.view,o);return}let s;try{s=await b()}catch(e){_(`mermaid: runtime unavailable (${R(e)}); diagrams stay as code`);return}if(!(u||!e.isConnected||t.generation!==i||t.source!==n))try{M(s,r);let o=`th-mermaid-${String(++I)}`,c=await P(()=>s.render(o,n));if(u||!e.isConnected||t.generation!==i||t.source!==n)return;A(a,c.svg),B(e,t,t.view,c.svg),Y.takeRecords()}catch(n){V(e,t),_(`mermaid: a diagram did not render (${R(n)}); it stays as code`)}},W=(e,t)=>{e.timer===void 0&&(e.timer=n.setTimeout(()=>{e.timer=void 0,U(t,e)},o))},G=e=>{e.timer!==void 0&&(n.clearTimeout(e.timer),e.timer=void 0)},K=e=>{let t=s.get(e);return t===void 0&&(t={source:``,view:`diagram`,attempted:void 0,svg:void 0,timer:void 0,generation:0,preview:void 0},s.set(e,t)),t},q=()=>{for(let[e,t]of s){let n=t.preview;if(n===void 0||!n.isConnected)continue;let r=n.querySelector(`[data-th-mermaid-label]`);r!==null&&(r.textContent=i(`mermaid.label`)),L(e,t,t.view)}},J=()=>{if(u)return;let e=v();if(f===void 0&&(f=e),e!==f){f=e;for(let[e,t]of s)t.preview!==void 0&&(t.attempted=void 0,W(t,e))}let n=t.documentElement.lang;p===void 0&&(p=n),n!==p&&(p=n,q());for(let[e,t]of s)e.isConnected||(G(t),s.delete(e));let r=t.querySelectorAll(S);for(let e of r){let t=e;if(t.closest(`[data-markdown-variant="compact"]`)!==null)continue;let n=t.querySelector(`[data-code-block-content] pre`);if(n===null)continue;let r=n.textContent??``,i=K(t),a=i.source;if(i.source=r,i.preview!==void 0&&!i.preview.isConnected&&(i.preview=void 0,t.removeAttribute(E),t.removeAttribute(D)),j(r)===void 0){G(i),i.preview!==void 0||t.hasAttribute(E)?H(t,i):i.attempted=void 0;continue}if(i.attempted===r){i.preview===void 0&&i.svg!==void 0&&(B(t,i,i.view,i.svg),Y.takeRecords());continue}if(i.timer!==void 0){if(r===a)continue;G(i)}W(i,t)}},Y=new MutationObserver(()=>{u||d===void 0&&(d=n.setTimeout(()=>{d=void 0,J()},a))});return Y.observe(t.documentElement,{childList:!0,subtree:!0,attributes:!0,characterData:!0}),J(),{scan:J,dispose:()=>{if(!u){u=!0,F=!1,Y.disconnect(),d!==void 0&&(n.clearTimeout(d),d=void 0);for(let[e,t]of s)G(t),t.preview?.remove(),e.removeAttribute(E),e.removeAttribute(D);s.clear(),c.clear(),t.getElementById(x)?.remove()}}}}function R(e){return e instanceof Error?e.message:String(e)}let z=`threadharbor-chat-area`,B=[`slots`,`locale`];function V(e){try{let t=e.logger(z);if(typeof t?.info==`function`&&typeof t?.warn==`function`)return t}catch{}return{info:e=>{console.info(`[${z}] ${e}`)},warn:e=>{console.warn(`[${z}] ${e}`)}}}function H(e){try{let t=e.locale?.register;if(typeof t!=`function`)return;t({threadharborChatArea:{zh:{..._},en:{}}})}catch{}}function U(e){let t=V(e);H(e);try{g(e.slots),t.info(`session id bar: registered`)}catch(e){t.warn(`session id bar: registration failed — ${e instanceof Error?e.message:String(e)}`)}try{L({t:y,log:e=>t.info(e)}),t.info(`mermaid: registered`)}catch(e){t.warn(`mermaid: registration failed — ${e instanceof Error?e.message:String(e)}`)}}return n.apply=U,n.inject=B,n.name=z,t.exports}});
//# sourceMappingURL=client.js.map