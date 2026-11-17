/* Typeset assignments without changing the editable source or trusting supplied HTML. */
(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const elements = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn '
    + 'Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu '
    + 'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '));

  function formula(source, display, original = source) {
    try {
      if (!root.katex || source.length > 8000) return escape(original);
      return root.katex.renderToString(source, {
        displayMode: !!display, throwOnError: true, trust: false,
        strict: 'ignore', maxExpand: 200, maxSize: 20,
      });
    } catch (_) {
      // Invalid or incomplete input remains visible while the teacher edits it.
      return escape(original);
    }
  }

  function chemical(token) {
    if (!/\d/.test(token)) return false;
    const parts = token.match(/[A-Z][a-z]?|\d+|[()]/g) || [];
    if (parts.join('') !== token) return false;
    const atoms = parts.filter(part => /^[A-Z]/.test(part));
    if (!atoms.every(atom => elements.has(atom))) return false;
    if (atoms.length < 2 && !/^(?:H2|N2|O2|F2|Cl2|Br2|I2)$/.test(token)) return false;
    let depth = 0;
    for (const part of parts) {
      if (part === '(') depth++;
      if (part === ')' && --depth < 0) return false;
    }
    return depth === 0;
  }

  function notation(text) {
    const scripts = /((?:\\(?:alpha|beta|gamma|theta|Delta|omega)|[A-Za-z\d)]|\([^\n()]+\))(?:(?:\^|_)\s*(?:\{[^{}\n]+\}|\([+\-\w ]+\)|[+\-]?\d+|[A-Za-z]))+)/g;
    return text.split(scripts).map((part, index) => {
      if (index % 2) return formula(part.replace(/([\^_])\(([^)]+)\)/g, '$1{$2}').replace(/([\^_])\s*([+\-]?\d+)/g, '$1{$2}'), false);
      // Complete chemical tokens only; experiment IDs and ordinary words stay literal.
      return part.split(/(\b(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+\b)/g)
        .map((chunk, index) => index % 2 && chemical(chunk) ? formula('\\ce{' + chunk + '}', false) : escape(chunk)).join('');
    }).join('');
  }

  function groupEnd(text, start, open = '{', close = '}') {
    if (text[start] !== open) return -1;
    let depth = 0;
    for (let index = start; index < text.length; index++) {
      if (text[index] === '\\') { index++; continue; }
      if (text[index] === open) depth++;
      if (text[index] === close && --depth === 0) return index + 1;
    }
    return -1;
  }

  function bare(text) {
    // Older generated worksheets sometimes contain unwrapped LaTeX commands.
    const commands = /\\(frac|dfrac|tfrac|sqrt|ce)\b/g;
    let output = '', last = 0, match;
    while ((match = commands.exec(text))) {
      let end = commands.lastIndex;
      const skipSpace = () => { while (end < text.length && /\s/.test(text[end])) end++; };
      skipSpace();
      if (match[1] === 'sqrt' && text[end] === '[') {
        end = groupEnd(text, end, '[', ']');
        if (end < 0) continue;
        skipSpace();
      }
      const count = /frac$/.test(match[1]) ? 2 : 1;
      for (let group = 0; group < count && end >= 0; group++) {
        skipSpace();
        end = groupEnd(text, end);
      }
      if (end < 0) continue;
      output += notation(text.slice(last, match.index));
      output += formula(text.slice(match.index, end), false);
      last = end;
      commands.lastIndex = end;
    }
    return output + notation(text.slice(last));
  }

  function plain(source) {
    // A URL or code sample is never treated as a formula.
    return source.split(/(https?:\/\/[^\s]+|`[^`]*`)/g)
      .map(part => /^(?:https?:\/\/|`)/.test(part) ? escape(part) : bare(part)).join('');
  }

  function html(value) {
    const text = String(value ?? '');
    const tokens = /(https?:\/\/[^\s]+|`[^`]*`)|(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\\d])\$([^$\n]+?)\$)/g;
    let output = '', last = 0, match;
    while ((match = tokens.exec(text))) {
      output += plain(text.slice(last, match.index));
      output += match[1] ? escape(match[1]) : formula(match[3] ?? match[4] ?? match[5] ?? match[6], match[3] !== undefined || match[4] !== undefined, match[0]);
      last = tokens.lastIndex;
    }
    return '<span class="scientific-text">' + output + plain(text.slice(last)) + '</span>';
  }

  function updatePreview(field) {
    if (!field.matches?.('textarea[data-asf]')) return;
    const preview = field.closest('.formula-field')?.querySelector('.formula-preview');
    if (preview) preview.innerHTML = html(field.value);
  }
  root.ScientificText = { html, updatePreview };
  if (typeof module !== 'undefined') module.exports = root.ScientificText;
  if (root.document) root.document.addEventListener('input', event => updatePreview(event.target));
})(typeof window !== 'undefined' ? window : globalThis);
