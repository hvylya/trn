'use strict';
// Схеми тіла: [м'яз, тег, атрибути, дзеркалити] у системі однієї фігури шириною 120
const SIL = [
  ['ellipse','cx="60" cy="20" rx="10.5" ry="12.5"',0], ['path','d="M53,30 L67,30 L69,40 L51,40 Z"',0],
  ['path','d="M38,40 Q60,35 82,40 L86,58 L80,104 L40,104 L34,58 Z"',0], ['path','d="M40,102 L80,102 L83,122 L37,122 Z"',0],
  ['ellipse','cx="29" cy="64" rx="6.5" ry="22"',1], ['ellipse','cx="25.5" cy="102" rx="5.2" ry="18"',1],
  ['ellipse','cx="24" cy="126" rx="4.2" ry="6"',1], ['ellipse','cx="49" cy="146" rx="10.5" ry="30"',1],
  ['ellipse','cx="50" cy="178" rx="6" ry="5"',1], ['ellipse','cx="50" cy="205" rx="7" ry="24"',1],
  ['ellipse','cx="50" cy="234" rx="8" ry="4"',1]];
const FRONT = [
  ['trapsU','path','d="M46,40 L56,37.5 L56,42 L41,44 Z"',1],
  ['deltS','ellipse','cx="30" cy="51" rx="4.5" ry="9"',1], ['deltF','ellipse','cx="36.5" cy="48" rx="6.5" ry="8.5"',1],
  ['chestU','path','d="M43,44 Q51,41.5 59,43 L59,51 Q50,52.5 42,50 Z"',1],
  ['chest','path','d="M42,50.5 Q50,53 59,51.5 L59,62 Q50,66 44,62 Q40.5,57 42,50.5 Z"',1],
  ['biceps','ellipse','cx="30" cy="67" rx="4.8" ry="11.5"',1], ['brachialis','ellipse','cx="25" cy="76" rx="2.4" ry="7"',1],
  ['forearm','ellipse','cx="25.5" cy="100" rx="4.4" ry="14"',1],
  ['abs','rect','x="52.5" y="64" width="15" height="38" rx="4"',0],
  ['obliques','path','d="M41,63 L51,66 L51,100 L44,98 L40,80 Z"',1],
  ['hipflex','path','d="M44,104 L56,107 L54.5,119 L46,116 Z"',1],
  ['quads','ellipse','cx="43.5" cy="148" rx="4.6" ry="22"',1], ['quads','ellipse','cx="54.5" cy="164" rx="3.6" ry="9"',1],
  ['adductors','path','d="M55,123 L59.5,123 L59.5,148 L56.5,153 L54,136 Z"',1],
  ['rectfem','ellipse','cx="50" cy="146" rx="4" ry="24"',1]];
const FRONT_SEAMS = '<path class="seamline" d="M60,65 V101 M53,74 H67 M53,83 H67 M53,92 H67"/>';
const BACK = [
  ['trapsU','path','d="M60,33 L60,52 L51,48 L40,44 Q49,40 54,35 Z"',1],
  ['midback','path','d="M60,52 L51,48 L47.5,57 L52,71 L60,75 Z"',1],
  ['deltS','ellipse','cx="30" cy="51" rx="4.5" ry="9"',1], ['deltR','ellipse','cx="36.5" cy="48" rx="6.5" ry="8.5"',1],
  ['lats','path','d="M38.5,58 L47,58.5 L52,72 L56,92 L46,98 L39,82 Z"',1],
  ['triceps','ellipse','cx="29.5" cy="66" rx="5.3" ry="13"',1], ['forearm','ellipse','cx="25.5" cy="100" rx="4.4" ry="14"',1],
  ['lowback','path','d="M54,78 L60,80 L60,104 L54,104 L52.5,88 Z"',1],
  ['glutemed','ellipse','cx="44" cy="110" rx="6.5" ry="6"',1], ['glutemax','ellipse','cx="51" cy="123" rx="9.5" ry="10"',1],
  ['hams','ellipse','cx="45.5" cy="155" rx="5" ry="21"',1], ['hams','ellipse','cx="54" cy="155" rx="4.5" ry="20"',1],
  ['calves','ellipse','cx="47" cy="200" rx="4.5" ry="14"',1], ['calves','ellipse','cx="53" cy="198" rx="4.5" ry="15"',1]];
const MIR = el => el + '<g transform="translate(120 0) scale(-1 1)">' + el + '</g>';
const silSvg = SIL.map(([t,a,m]) => { const el = `<${t} ${a} class="sil"/>`; return m ? MIR(el) : el; }).join('');
function view(shapes, cls, tip){
  return silSvg + shapes.map(([k,t,a,m]) => {
    const el = `<${t} ${a} class="${cls(k)}"><title>${tip(k)}</title></${t}>`;
    return m ? MIR(el) : el; }).join('');
}
function bodySvg(cls, tip, label){
  return `<svg viewBox="0 0 240 242" role="img" aria-label="${esc(label)}"><g>${view(FRONT,cls,tip)}${FRONT_SEAMS}</g><g transform="translate(120 0)">${view(BACK,cls,tip)}</g></svg><div class="vw"><span>спереду</span><span>ззаду</span></div>`;
}
