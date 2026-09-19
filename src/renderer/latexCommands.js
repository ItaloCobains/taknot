/** Common KaTeX / TeX commands for autocomplete inside $...$ / $$...$$. */

export const LATEX_COMMANDS = [
  { id: 'frac', label: '\\frac', hint: '{a}{b}', insert: '\\frac{}{}', cursor: 6 },
  { id: 'sqrt', label: '\\sqrt', hint: '{x}', insert: '\\sqrt{}', cursor: 6 },
  { id: 'sum', label: '\\sum', hint: '∑', insert: '\\sum_{i=1}^{n}', cursor: 6 },
  { id: 'prod', label: '\\prod', hint: '∏', insert: '\\prod_{i=1}^{n}', cursor: 7 },
  { id: 'int', label: '\\int', hint: '∫', insert: '\\int_{a}^{b}', cursor: 6 },
  { id: 'lim', label: '\\lim', hint: 'lim', insert: '\\lim_{x \\to \\infty}', cursor: 6 },
  { id: 'infty', label: '\\infty', hint: '∞', insert: '\\infty', cursor: 7 },
  { id: 'partial', label: '\\partial', hint: '∂', insert: '\\partial', cursor: 8 },
  { id: 'nabla', label: '\\nabla', hint: '∇', insert: '\\nabla', cursor: 7 },
  { id: 'cdot', label: '\\cdot', hint: '·', insert: '\\cdot', cursor: 6 },
  { id: 'times', label: '\\times', hint: '×', insert: '\\times', cursor: 7 },
  { id: 'div', label: '\\div', hint: '÷', insert: '\\div', cursor: 5 },
  { id: 'pm', label: '\\pm', hint: '±', insert: '\\pm', cursor: 4 },
  { id: 'mp', label: '\\mp', hint: '∓', insert: '\\mp', cursor: 4 },
  { id: 'leq', label: '\\leq', hint: '≤', insert: '\\leq', cursor: 5 },
  { id: 'geq', label: '\\geq', hint: '≥', insert: '\\geq', cursor: 5 },
  { id: 'neq', label: '\\neq', hint: '≠', insert: '\\neq', cursor: 5 },
  { id: 'approx', label: '\\approx', hint: '≈', insert: '\\approx', cursor: 8 },
  { id: 'equiv', label: '\\equiv', hint: '≡', insert: '\\equiv', cursor: 7 },
  { id: 'sim', label: '\\sim', hint: '∼', insert: '\\sim', cursor: 5 },
  { id: 'propto', label: '\\propto', hint: '∝', insert: '\\propto', cursor: 8 },
  { id: 'rightarrow', label: '\\rightarrow', hint: '→', insert: '\\rightarrow', cursor: 12 },
  { id: 'leftarrow', label: '\\leftarrow', hint: '←', insert: '\\leftarrow', cursor: 11 },
  { id: 'Rightarrow', label: '\\Rightarrow', hint: '⇒', insert: '\\Rightarrow', cursor: 12 },
  { id: 'Leftrightarrow', label: '\\Leftrightarrow', hint: '⇔', insert: '\\Leftrightarrow', cursor: 15 },
  { id: 'to', label: '\\to', hint: '→', insert: '\\to', cursor: 4 },
  { id: 'mapsto', label: '\\mapsto', hint: '↦', insert: '\\mapsto', cursor: 8 },
  { id: 'in', label: '\\in', hint: '∈', insert: '\\in', cursor: 4 },
  { id: 'notin', label: '\\notin', hint: '∉', insert: '\\notin', cursor: 7 },
  { id: 'subset', label: '\\subset', hint: '⊂', insert: '\\subset', cursor: 8 },
  { id: 'subseteq', label: '\\subseteq', hint: '⊆', insert: '\\subseteq', cursor: 10 },
  { id: 'cup', label: '\\cup', hint: '∪', insert: '\\cup', cursor: 5 },
  { id: 'cap', label: '\\cap', hint: '∩', insert: '\\cap', cursor: 5 },
  { id: 'emptyset', label: '\\emptyset', hint: '∅', insert: '\\emptyset', cursor: 9 },
  { id: 'forall', label: '\\forall', hint: '∀', insert: '\\forall', cursor: 8 },
  { id: 'exists', label: '\\exists', hint: '∃', insert: '\\exists', cursor: 8 },
  { id: 'neg', label: '\\neg', hint: '¬', insert: '\\neg', cursor: 5 },
  { id: 'land', label: '\\land', hint: '∧', insert: '\\land', cursor: 6 },
  { id: 'lor', label: '\\lor', hint: '∨', insert: '\\lor', cursor: 5 },
  { id: 'alpha', label: '\\alpha', hint: 'α', insert: '\\alpha', cursor: 7 },
  { id: 'beta', label: '\\beta', hint: 'β', insert: '\\beta', cursor: 6 },
  { id: 'gamma', label: '\\gamma', hint: 'γ', insert: '\\gamma', cursor: 7 },
  { id: 'delta', label: '\\delta', hint: 'δ', insert: '\\delta', cursor: 7 },
  { id: 'Delta', label: '\\Delta', hint: 'Δ', insert: '\\Delta', cursor: 7 },
  { id: 'epsilon', label: '\\epsilon', hint: 'ε', insert: '\\epsilon', cursor: 9 },
  { id: 'theta', label: '\\theta', hint: 'θ', insert: '\\theta', cursor: 7 },
  { id: 'lambda', label: '\\lambda', hint: 'λ', insert: '\\lambda', cursor: 8 },
  { id: 'mu', label: '\\mu', hint: 'μ', insert: '\\mu', cursor: 4 },
  { id: 'pi', label: '\\pi', hint: 'π', insert: '\\pi', cursor: 4 },
  { id: 'sigma', label: '\\sigma', hint: 'σ', insert: '\\sigma', cursor: 7 },
  { id: 'Sigma', label: '\\Sigma', hint: 'Σ', insert: '\\Sigma', cursor: 7 },
  { id: 'phi', label: '\\phi', hint: 'φ', insert: '\\phi', cursor: 5 },
  { id: 'omega', label: '\\omega', hint: 'ω', insert: '\\omega', cursor: 7 },
  { id: 'Omega', label: '\\Omega', hint: 'Ω', insert: '\\Omega', cursor: 7 },
  { id: 'mathbb', label: '\\mathbb', hint: 'ℝ', insert: '\\mathbb{}', cursor: 8 },
  { id: 'mathbf', label: '\\mathbf', hint: 'bold', insert: '\\mathbf{}', cursor: 8 },
  { id: 'mathrm', label: '\\mathrm', hint: 'roman', insert: '\\mathrm{}', cursor: 8 },
  { id: 'text', label: '\\text', hint: '{…}', insert: '\\text{}', cursor: 6 },
  { id: 'hat', label: '\\hat', hint: 'x̂', insert: '\\hat{}', cursor: 5 },
  { id: 'bar', label: '\\bar', hint: 'x̄', insert: '\\bar{}', cursor: 5 },
  { id: 'vec', label: '\\vec', hint: 'x⃗', insert: '\\vec{}', cursor: 5 },
  { id: 'dot', label: '\\dot', hint: 'ẋ', insert: '\\dot{}', cursor: 5 },
  { id: 'ddot', label: '\\ddot', hint: 'ẍ', insert: '\\ddot{}', cursor: 6 },
  { id: 'overline', label: '\\overline', hint: 'x̄', insert: '\\overline{}', cursor: 10 },
  { id: 'underline', label: '\\underline', hint: 'x̲', insert: '\\underline{}', cursor: 11 },
  { id: 'begin', label: '\\begin', hint: '{env}', insert: '\\begin{matrix}\n\n\\end{matrix}', cursor: 14 },
  { id: 'matrix', label: '\\begin{matrix}', hint: 'matrix', insert: '\\begin{matrix}\n a & b \\\\\n c & d \n\\end{matrix}', cursor: 15 },
  { id: 'pmatrix', label: '\\begin{pmatrix}', hint: '(matrix)', insert: '\\begin{pmatrix}\n a & b \\\\\n c & d \n\\end{pmatrix}', cursor: 16 },
  { id: 'cases', label: '\\begin{cases}', hint: 'cases', insert: '\\begin{cases}\n  \\\\\n\\end{cases}', cursor: 14 },
  { id: 'left', label: '\\left(', hint: 'sizing', insert: '\\left( \\right)', cursor: 6 },
  { id: 'right', label: '\\right)', hint: 'sizing', insert: '\\right)', cursor: 7 },
  { id: 'binom', label: '\\binom', hint: 'n choose k', insert: '\\binom{}{}', cursor: 7 },
  { id: 'overset', label: '\\overset', hint: '{a}{b}', insert: '\\overset{}{}', cursor: 9 },
  { id: 'underset', label: '\\underset', hint: '{a}{b}', insert: '\\underset{}{}', cursor: 10 },
  { id: 'operatorname', label: '\\operatorname', hint: '{name}', insert: '\\operatorname{}', cursor: 14 },
  { id: 'sin', label: '\\sin', hint: 'sin', insert: '\\sin', cursor: 5 },
  { id: 'cos', label: '\\cos', hint: 'cos', insert: '\\cos', cursor: 5 },
  { id: 'tan', label: '\\tan', hint: 'tan', insert: '\\tan', cursor: 5 },
  { id: 'log', label: '\\log', hint: 'log', insert: '\\log', cursor: 5 },
  { id: 'ln', label: '\\ln', hint: 'ln', insert: '\\ln', cursor: 4 },
  { id: 'exp', label: '\\exp', hint: 'exp', insert: '\\exp', cursor: 5 },
  { id: 'max', label: '\\max', hint: 'max', insert: '\\max', cursor: 5 },
  { id: 'min', label: '\\min', hint: 'min', insert: '\\min', cursor: 5 },
  { id: 'arg', label: '\\arg', hint: 'arg', insert: '\\arg', cursor: 5 },
  { id: 'det', label: '\\det', hint: 'det', insert: '\\det', cursor: 5 },
];

export function filterLatexCommands(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return LATEX_COMMANDS.slice(0, 12);
  return LATEX_COMMANDS.filter(
    (c) =>
      c.id.toLowerCase().startsWith(q) ||
      c.id.toLowerCase().includes(q) ||
      c.label.toLowerCase().includes(q),
  ).slice(0, 12);
}

/** True when caret is inside $...$ or $$...$$. */
export function inMathContext(body, caret) {
  let i = 0;
  let inDisplay = false;
  let inInline = false;
  const text = String(body || '');
  const end = Math.min(caret, text.length);
  while (i < end) {
    if (text.startsWith('$$', i)) {
      inDisplay = !inDisplay;
      inInline = false;
      i += 2;
      continue;
    }
    if (text[i] === '$') {
      if (!inDisplay) inInline = !inInline;
      i += 1;
      continue;
    }
    i += 1;
  }
  return inDisplay || inInline;
}

/**
 * Active `\\command` being typed inside math.
 * Returns { start, end, query } or null.
 */
export function detectLatex(body, caret) {
  if (!inMathContext(body, caret)) return null;
  const before = String(body || '').slice(0, caret);
  const match = before.match(/\\([a-zA-Z]*)$/);
  if (!match) return null;
  const start = caret - match[0].length;
  return { start, end: caret, query: match[1] };
}
