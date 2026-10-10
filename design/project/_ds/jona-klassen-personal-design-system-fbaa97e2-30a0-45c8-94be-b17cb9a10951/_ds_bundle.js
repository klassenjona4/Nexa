/* @ds-bundle: {"format":4,"namespace":"JonaKlassenPersonalDesignSystem_fbaa97","components":[{"name":"ImagePlaceholder","sourcePath":"components/core/ImagePlaceholder.jsx"},{"name":"Label","sourcePath":"components/core/Label.jsx"},{"name":"BarChart","sourcePath":"components/data/BarChart.jsx"},{"name":"GroupedBarChart","sourcePath":"components/data/GroupedBarChart.jsx"},{"name":"BlockQuote","sourcePath":"components/document/BlockQuote.jsx"},{"name":"CoverPage","sourcePath":"components/document/CoverPage.jsx"},{"name":"DataTable","sourcePath":"components/document/DataTable.jsx"},{"name":"DocPage","sourcePath":"components/document/DocPage.jsx"},{"name":"Figure","sourcePath":"components/document/Figure.jsx"},{"name":"Footnotes","sourcePath":"components/document/Footnotes.jsx"},{"name":"Heading","sourcePath":"components/document/Heading.jsx"},{"name":"Paragraph","sourcePath":"components/document/Paragraph.jsx"},{"name":"ReferenceList","sourcePath":"components/document/ReferenceList.jsx"},{"name":"TableOfContents","sourcePath":"components/document/TableOfContents.jsx"},{"name":"ChartSlide","sourcePath":"components/slides/ChartSlide.jsx"},{"name":"ClosingSlide","sourcePath":"components/slides/ClosingSlide.jsx"},{"name":"ContentSlide","sourcePath":"components/slides/ContentSlide.jsx"},{"name":"ImageSlide","sourcePath":"components/slides/ImageSlide.jsx"},{"name":"QuoteSlide","sourcePath":"components/slides/QuoteSlide.jsx"},{"name":"SectionDivider","sourcePath":"components/slides/SectionDivider.jsx"},{"name":"Slide","sourcePath":"components/slides/Slide.jsx"},{"name":"SlideMeta","sourcePath":"components/slides/SlideMeta.jsx"},{"name":"TitleSlide","sourcePath":"components/slides/TitleSlide.jsx"}],"sourceHashes":{"components/core/ImagePlaceholder.jsx":"af298377e1d8","components/core/Label.jsx":"dc308d3f6699","components/data/BarChart.jsx":"069e7199d47c","components/data/GroupedBarChart.jsx":"7d06a4a9cbc6","components/document/BlockQuote.jsx":"c95a148e7f8c","components/document/CoverPage.jsx":"50d949fb6330","components/document/DataTable.jsx":"997b0a708589","components/document/DocPage.jsx":"6f88958886c2","components/document/Figure.jsx":"67d08f185cfc","components/document/Footnotes.jsx":"196c74f875e6","components/document/Heading.jsx":"37402df943ab","components/document/Paragraph.jsx":"f99614ed1369","components/document/ReferenceList.jsx":"563376bd5719","components/document/TableOfContents.jsx":"409a3516994f","components/slides/ChartSlide.jsx":"f9b389cb1ed1","components/slides/ClosingSlide.jsx":"57ff1e8effdd","components/slides/ContentSlide.jsx":"28c2c6ae4028","components/slides/ImageSlide.jsx":"75bc9c4e75b6","components/slides/QuoteSlide.jsx":"4a2cf5dcb932","components/slides/SectionDivider.jsx":"de9c453c6b61","components/slides/Slide.jsx":"edca71134a23","components/slides/SlideMeta.jsx":"cc71a6b4f4aa","components/slides/TitleSlide.jsx":"81064b3d5acd"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.JonaKlassenPersonalDesignSystem_fbaa97 = window.JonaKlassenPersonalDesignSystem_fbaa97 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/ImagePlaceholder.jsx
try { (() => {
function ImagePlaceholder({
  children,
  src,
  alt = '',
  ratio,
  tone = 'mist',
  fontSize = '9pt',
  grayscale = true,
  style
}) {
  if (src) return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      display: 'block',
      width: '100%',
      height: ratio ? 'auto' : '100%',
      aspectRatio: ratio,
      objectFit: 'cover',
      filter: grayscale ? 'grayscale(1)' : 'none',
      ...style
    }
  });
  const sage = tone === 'sage';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: sage ? 'var(--sage)' : 'var(--mist)',
      aspectRatio: ratio,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '8pt',
      fontFamily: 'var(--font-sans)',
      fontSize,
      color: sage ? 'var(--ink)' : 'var(--graphite)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { ImagePlaceholder });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ImagePlaceholder.jsx", error: String((e && e.message) || e) }); }

// components/core/Label.jsx
try { (() => {
const LABEL_COLORS = {
  ink: 'var(--ink)',
  graphite: 'var(--graphite)',
  rust: 'var(--rust)',
  sage: 'var(--sage)',
  paper: 'var(--paper)'
};
const LABEL_SIZES = {
  doc: 'var(--doc-label-size)',
  slide: 'var(--slide-label-size)',
  screen: '12px'
};
function Label({
  children,
  color = 'ink',
  size = 'doc',
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: LABEL_SIZES[size] || size,
      fontWeight: 600,
      letterSpacing: 'var(--label-tracking)',
      textTransform: 'uppercase',
      lineHeight: 1.2,
      color: LABEL_COLORS[color] || color,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Label.jsx", error: String((e && e.message) || e) }); }

// components/data/BarChart.jsx
try { (() => {
const BAR_SIZES = {
  slide: {
    font: '16pt',
    head: '12pt',
    col: '74pt',
    gap: '22pt',
    bar: '40pt',
    inner: '10pt',
    colGap: '12pt'
  },
  compact: {
    font: '13px',
    head: '12px',
    col: '56px',
    gap: '10px',
    bar: '20px',
    inner: '6px',
    colGap: '8px'
  }
};
function BarChart({
  data = [],
  highlight,
  max,
  size = 'compact',
  unit = '',
  categoryLabel,
  valueLabel,
  baseline = true
}) {
  const s = BAR_SIZES[size] || BAR_SIZES.compact;
  const top = max || Math.max(...data.map(d => d.value), 1) / 0.88;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: s.gap,
      fontFamily: 'var(--font-sans)',
      fontSize: s.font,
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--ink)'
    }
  }, (categoryLabel || valueLabel) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: s.col + ' minmax(0,1fr)',
      gap: s.colGap,
      paddingBottom: '10pt',
      borderBottom: '0.5pt solid var(--sage)',
      fontSize: s.head,
      color: 'var(--graphite)'
    }
  }, /*#__PURE__*/React.createElement("span", null, categoryLabel), /*#__PURE__*/React.createElement("span", null, valueLabel)), data.map((d, i) => {
    const hi = i === highlight;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'grid',
        gridTemplateColumns: s.col + ' minmax(0,1fr)',
        gap: s.colGap,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: hi ? 600 : 400
      }
    }, d.label), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: s.inner,
        borderLeft: baseline ? '1pt solid var(--ink)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: s.bar,
        width: d.value / top * 100 + '%',
        background: hi ? 'var(--rust)' : 'var(--stone)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: hi ? 600 : 400,
        color: hi ? 'var(--rust)' : 'var(--ink)'
      }
    }, d.value, unit)));
  }));
}
Object.assign(__ds_scope, { BarChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BarChart.jsx", error: String((e && e.message) || e) }); }

// components/data/GroupedBarChart.jsx
try { (() => {
const GBC_SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
function GroupedBarChart({
  categories = [],
  series = [],
  max,
  height = 140,
  gridlines = 2,
  note
}) {
  const top = max || Math.max(...categories.flatMap(c => c.values), 1) / 0.8;
  const lines = Array.from({
    length: gridlines
  }, (_, i) => (i + 1) / (gridlines + 1));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      fontFamily: 'var(--font-sans)',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '20px',
      height: height + 'px',
      borderBottom: '1px solid var(--ink)',
      position: 'relative'
    }
  }, lines.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: f * 100 + '%',
      borderTop: '0.5px solid var(--sage)'
    }
  })), categories.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      gap: '4px',
      alignItems: 'flex-end',
      height: '100%',
      position: 'relative'
    }
  }, c.values.map((v, j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    style: {
      flex: 1,
      height: v / top * 100 + '%',
      background: GBC_SERIES[j % 5]
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '20px',
      fontSize: '12px'
    }
  }, categories.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      flex: 1,
      textAlign: 'center'
    }
  }, c.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '16px',
      fontSize: '12px',
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, series.map((s, j) => /*#__PURE__*/React.createElement("span", {
    key: j,
    style: {
      display: 'flex',
      gap: '6px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: '10px',
      height: '10px',
      background: GBC_SERIES[j % 5]
    }
  }), s)), note && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--graphite)'
    }
  }, note)));
}
Object.assign(__ds_scope, { GroupedBarChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/GroupedBarChart.jsx", error: String((e && e.message) || e) }); }

// components/document/BlockQuote.jsx
try { (() => {
function BlockQuote({
  children,
  citation
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '24pt 0'
    }
  }, /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: '0 0 8pt 12mm',
      fontFamily: 'var(--font-serif)',
      fontStyle: 'italic',
      fontSize: '12pt',
      lineHeight: '18pt',
      color: 'var(--ink)'
    }
  }, children), citation && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 0 12mm',
      fontFamily: 'var(--font-sans)',
      fontSize: '9pt',
      color: 'var(--graphite)'
    }
  }, citation));
}
Object.assign(__ds_scope, { BlockQuote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/BlockQuote.jsx", error: String((e && e.message) || e) }); }

// components/document/DataTable.jsx
try { (() => {
function DataTable({
  number,
  title,
  columns = [],
  rows = [],
  highlight,
  widths
}) {
  const tpl = widths || columns.map((c, i) => i === 0 ? 'minmax(0,2fr)' : 'minmax(0,1fr)').join(' ');
  const cell = (v, ci, ri) => {
    const c = columns[ci] || {};
    const hi = highlight && highlight.row === ri && highlight.col === ci;
    return /*#__PURE__*/React.createElement("span", {
      key: ci,
      style: {
        textAlign: c.align || (ci === 0 ? 'left' : 'right'),
        color: hi ? 'var(--rust)' : undefined,
        fontWeight: hi ? 600 : undefined
      }
    }, v);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '24pt 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '8pt',
      fontFamily: 'var(--font-sans)'
    }
  }, (number || title) && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: '9pt',
      lineHeight: '12pt',
      color: 'var(--graphite)'
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, "Table ", number, "."), " ", title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      fontSize: '9pt',
      lineHeight: '12pt',
      borderTop: '1pt solid var(--ink)',
      borderBottom: '1pt solid var(--ink)',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: tpl,
      gap: '8pt',
      padding: '4pt 0',
      borderBottom: '0.5pt solid var(--ink)',
      fontWeight: 600
    }
  }, columns.map((c, ci) => /*#__PURE__*/React.createElement("span", {
    key: ci,
    style: {
      textAlign: c.align || (ci === 0 ? 'left' : 'right')
    }
  }, c.label))), rows.map((r, ri) => /*#__PURE__*/React.createElement("div", {
    key: ri,
    style: {
      display: 'grid',
      gridTemplateColumns: tpl,
      gap: '8pt',
      padding: '4pt 0',
      borderBottom: ri < rows.length - 1 ? '0.5pt solid var(--sage)' : 'none'
    }
  }, r.map((v, ci) => cell(v, ci, ri))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/document/DocPage.jsx
try { (() => {
function DocPage({
  header,
  pageNumber,
  label,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    "data-screen-label": label,
    style: {
      width: 'var(--doc-w)',
      height: 'var(--doc-h)',
      flex: 'none',
      background: 'var(--white)',
      color: 'var(--ink)',
      padding: '25mm 30mm',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      boxSizing: 'border-box',
      ...style
    }
  }, header && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '30mm',
      right: '30mm',
      top: '12.5mm',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '8pt',
      color: 'var(--graphite)'
    }
  }, /*#__PURE__*/React.createElement("span", null, header.left), /*#__PURE__*/React.createElement("span", null, header.right)), children, pageNumber != null && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: '30mm',
      bottom: '12.5mm',
      fontSize: '8pt',
      color: 'var(--graphite)'
    }
  }, pageNumber));
}
Object.assign(__ds_scope, { DocPage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/DocPage.jsx", error: String((e && e.message) || e) }); }

// components/document/CoverPage.jsx
try { (() => {
function CoverPage({
  institution = [],
  programme = [],
  label,
  title,
  subtitle,
  fields = []
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.DocPage, {
    label: "Cover page"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '24pt',
      fontSize: '9pt',
      lineHeight: '12pt',
      letterSpacing: '0.01em',
      color: 'var(--graphite)'
    }
  }, /*#__PURE__*/React.createElement("span", null, institution.map((l, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("br", null), l))), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, programme.map((l, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("br", null), l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '84mm',
      display: 'flex',
      flexDirection: 'column',
      gap: '8pt',
      width: '122mm'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '8pt',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }, label), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: '32pt',
      fontWeight: 600,
      lineHeight: '35pt',
      letterSpacing: '-0.02em',
      textWrap: 'pretty'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '14pt',
      lineHeight: '18pt',
      color: 'var(--graphite)'
    }
  }, subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      borderTop: '1pt solid var(--ink)',
      paddingTop: '12pt',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16pt 6mm'
    }
  }, fields.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4pt'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '8pt',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--graphite)'
    }
  }, f.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '11pt'
    }
  }, f.value)))));
}
Object.assign(__ds_scope, { CoverPage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/CoverPage.jsx", error: String((e && e.message) || e) }); }

// components/document/Figure.jsx
try { (() => {
function Figure({
  number,
  caption,
  source,
  src,
  placeholder = 'Image',
  ratio = '3/2',
  width = '100%'
}) {
  return /*#__PURE__*/React.createElement("figure", {
    style: {
      margin: '24pt 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '8pt'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ImagePlaceholder, {
    src: src,
    ratio: ratio
  }, placeholder)), /*#__PURE__*/React.createElement("figcaption", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-sans)',
      fontSize: '9pt',
      lineHeight: '12pt',
      letterSpacing: '0.01em',
      color: 'var(--graphite)',
      maxWidth: '100mm'
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, "Figure ", number, "."), " ", caption, source && /*#__PURE__*/React.createElement(React.Fragment, null, " Source: ", source, ".")));
}
Object.assign(__ds_scope, { Figure });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/Figure.jsx", error: String((e && e.message) || e) }); }

// components/document/Footnotes.jsx
try { (() => {
function Footnotes({
  notes = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6pt'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '40mm',
      borderTop: '0.5pt solid var(--ink)'
    }
  }), notes.map((n, i) => /*#__PURE__*/React.createElement("p", {
    key: i,
    style: {
      margin: 0,
      fontFamily: 'var(--font-serif)',
      fontSize: '8.5pt',
      lineHeight: '11.5pt',
      color: 'var(--graphite)'
    }
  }, /*#__PURE__*/React.createElement("sup", null, n.n ?? i + 1), " ", n.text)));
}
Object.assign(__ds_scope, { Footnotes });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/Footnotes.jsx", error: String((e && e.message) || e) }); }

// components/document/Heading.jsx
try { (() => {
const HEADING_STYLES = {
  1: {
    fontSize: '20pt',
    lineHeight: '24pt',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    margin: '24pt 0 8pt'
  },
  2: {
    fontSize: '14pt',
    lineHeight: '18pt',
    fontWeight: 600,
    margin: '16pt 0 4pt'
  },
  3: {
    fontSize: '11pt',
    lineHeight: '15pt',
    fontWeight: 700,
    margin: '12pt 0 4pt'
  }
};
function Heading({
  level = 1,
  first = false,
  children,
  style
}) {
  const Tag = 'h' + (level + 1);
  const s = HEADING_STYLES[level] || HEADING_STYLES[1];
  return /*#__PURE__*/React.createElement(Tag, {
    style: {
      fontFamily: 'var(--font-sans)',
      color: 'var(--ink)',
      ...s,
      ...(first ? {
        marginTop: 0
      } : null),
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Heading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/Heading.jsx", error: String((e && e.message) || e) }); }

// components/document/Paragraph.jsx
try { (() => {
function Paragraph({
  children,
  last = false,
  style
}) {
  return /*#__PURE__*/React.createElement("p", {
    style: {
      margin: last ? 0 : '0 0 8pt',
      fontFamily: 'var(--font-serif)',
      fontSize: '11pt',
      lineHeight: '16.5pt',
      color: 'var(--ink)',
      textWrap: 'pretty',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Paragraph });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/Paragraph.jsx", error: String((e && e.message) || e) }); }

// components/document/ReferenceList.jsx
try { (() => {
function ReferenceList({
  title = 'References',
  entries = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6pt'
    }
  }, title && /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '0 0 6pt',
      fontFamily: 'var(--font-sans)',
      fontSize: '20pt',
      lineHeight: '24pt',
      fontWeight: 600,
      letterSpacing: '-0.01em'
    }
  }, title), entries.map((e, i) => /*#__PURE__*/React.createElement("p", {
    key: i,
    style: {
      margin: 0,
      fontFamily: 'var(--font-serif)',
      fontSize: '10pt',
      lineHeight: '14pt',
      paddingLeft: '10mm',
      textIndent: '-10mm',
      color: 'var(--ink)'
    }
  }, e)));
}
Object.assign(__ds_scope, { ReferenceList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/ReferenceList.jsx", error: String((e && e.message) || e) }); }

// components/document/TableOfContents.jsx
try { (() => {
function TableOfContents({
  title = 'Contents',
  entries = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '20pt',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      marginBottom: '12pt'
    }
  }, title), entries.map((e, i) => {
    const sub = e.level === 2;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
        padding: sub ? '4pt 0 4pt 8mm' : '4pt 0',
        borderBottom: '0.5pt solid var(--sage)',
        fontFamily: sub ? 'var(--font-serif)' : 'var(--font-sans)',
        fontSize: '11pt',
        fontWeight: sub ? 400 : 600
      }
    }, /*#__PURE__*/React.createElement("span", null, e.label), /*#__PURE__*/React.createElement("span", null, e.page));
  }));
}
Object.assign(__ds_scope, { TableOfContents });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/document/TableOfContents.jsx", error: String((e && e.message) || e) }); }

// components/slides/Slide.jsx
try { (() => {
const SLIDE_BG = {
  paper: 'var(--paper)',
  ink: 'var(--ink)',
  mist: 'var(--mist)'
};
function Slide({
  tone = 'paper',
  label,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    "data-screen-label": label,
    style: {
      width: 'var(--slide-w)',
      height: 'var(--slide-h)',
      flex: 'none',
      background: SLIDE_BG[tone] || SLIDE_BG.paper,
      color: tone === 'ink' ? 'var(--paper)' : 'var(--ink)',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Slide });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/slides/Slide.jsx", error: String((e && e.message) || e) }); }

// components/slides/ClosingSlide.jsx
try { (() => {
function ClosingSlide({
  title = 'Questions',
  items = []
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Slide, {
    tone: "ink",
    label: "Closing"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '48pt',
      top: '96pt',
      fontSize: 'var(--slide-title-size)',
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '-0.03em'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '48pt',
      right: '48pt',
      bottom: '48pt',
      borderTop: '1pt solid var(--stone)',
      paddingTop: '12pt',
      display: 'grid',
      gridTemplateColumns: 'repeat(' + (items.length || 2) + ',1fr)',
      gap: '24pt',
      fontSize: '14pt',
      lineHeight: 1.4
    }
  }, items.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--sage)'
    }
  }, m.label), /*#__PURE__*/React.createElement("span", null, m.value)))));
}
Object.assign(__ds_scope, { ClosingSlide });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/slides/ClosingSlide.jsx", error: String((e && e.message) || e) }); }

// components/slides/SectionDivider.jsx
try { (() => {
function SectionDivider({
  number,
  name,
  label = 'Section'
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Slide, {
    tone: "ink",
    label: "Section divider"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '48pt',
      top: '48pt',
      fontSize: '12pt',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--sage)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: '48pt',
      top: '30pt',
      fontSize: 'var(--slide-divider-number-size)',
      fontWeight: 500,
      lineHeight: 1,
      letterSpacing: '-0.04em',
      color: 'var(--stone)'
    }
  }, number), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '48pt',
      right: '48pt',
      bottom: '48pt',
      fontSize: 'var(--slide-divider-size)',
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '-0.03em',
      maxWidth: '640pt'
    }
  }, name));
}
Object.assign(__ds_scope, { SectionDivider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/slides/SectionDivider.jsx", error: String((e && e.message) || e) }); }

// components/slides/SlideMeta.jsx
try { (() => {
function SlideMeta({
  items = [],
  position = 'top',
  left = '48pt',
  right = '48pt',
  color
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left,
      right,
      [position]: 'var(--slide-meta-offset)',
      display: 'flex',
      justifyContent: 'space-between',
      gap: '24pt',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--slide-meta-size)',
      color: color || 'var(--graphite)'
    }
  }, items.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, t)));
}
Object.assign(__ds_scope, { SlideMeta });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/slides/SlideMeta.jsx", error: String((e && e.message) || e) }); }

// components/slides/ChartSlide.jsx
try { (() => {
function ChartSlide({
  title,
  description,
  data = [],
  highlight,
  categoryLabel,
  valueLabel,
  meta = [],
  source,
  page
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Slide, {
    tone: "paper",
    label: "Chart"
  }, /*#__PURE__*/React.createElement(__ds_scope.SlideMeta, {
    items: meta
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      position: 'absolute',
      left: '48pt',
      width: '370pt',
      top: '96pt',
      margin: 0,
      fontSize: 'var(--slide-h1-size)',
      fontWeight: 600,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      textWrap: 'pretty'
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      position: 'absolute',
      left: '48pt',
      width: '296pt',
      top: '300pt',
      margin: 0,
      fontFamily: 'var(--font-serif)',
      fontSize: '18pt',
      lineHeight: 1.4
    }
  }, description), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '444pt',
      right: '48pt',
      top: '104pt'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.BarChart, {
    data: data,
    highlight: highlight,
    size: "slide",
    categoryLabel: categoryLabel,
    valueLabel: valueLabel
  })), /*#__PURE__*/React.createElement(__ds_scope.SlideMeta, {
    items: [source, page].filter(Boolean),
    position: "bottom"
  }));
}
Object.assign(__ds_scope, { ChartSlide });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/slides/ChartSlide.jsx", error: String((e && e.message) || e) }); }

// components/slides/ContentSlide.jsx
try { (() => {
function ContentSlide({
  title,
  points = [],
  meta = [],
  footer = []
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Slide, {
    tone: "paper",
    label: "Content"
  }, /*#__PURE__*/React.createElement(__ds_scope.SlideMeta, {
    items: meta
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      position: 'absolute',
      left: '48pt',
      top: '96pt',
      width: '370pt',
      margin: 0,
      fontSize: 'var(--slide-h1-size)',
      fontWeight: 600,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      textWrap: 'pretty'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '520pt',
      right: '48pt',
      top: '104pt',
      display: 'flex',
      flexDirection: 'column',
      gap: '16pt',
      fontFamily: 'var(--font-serif)',
      fontSize: 'var(--slide-body-size)',
      lineHeight: 1.4
    }
  }, points.map((p, i) => /*#__PURE__*/React.createElement("p", {
    key: i,
    style: {
      margin: 0,
      textWrap: 'pretty'
    }
  }, p))), /*#__PURE__*/React.createElement(__ds_scope.SlideMeta, {
    items: footer,
    position: "bottom"
  }));
}
Object.assign(__ds_scope, { ContentSlide });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/slides/ContentSlide.jsx", error: String((e && e.message) || e) }); }

// components/slides/ImageSlide.jsx
try { (() => {
function ImageSlide({
  src,
  imageLabel = 'Photograph, full bleed, half slide',
  title,
  body = [],
  meta = [],
  credit,
  page
}) {
  const paras = Array.isArray(body) ? body : [body];
  return /*#__PURE__*/React.createElement(__ds_scope.Slide, {
    tone: "paper",
    label: "Image"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 'var(--slide-half)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ImagePlaceholder, {
    src: src,
    tone: "sage",
    fontSize: "14pt",
    style: {
      height: '100%'
    }
  }, imageLabel)), /*#__PURE__*/React.createElement(__ds_scope.SlideMeta, {
    items: meta,
    left: "522pt"
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      position: 'absolute',
      left: '522pt',
      right: '48pt',
      top: '96pt',
      margin: 0,
      fontSize: 'var(--slide-h1-size)',
      fontWeight: 600,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      textWrap: 'pretty'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '522pt',
      right: '48pt',
      top: '264pt',
      display: 'flex',
      flexDirection: 'column',
      gap: '16pt',
      fontFamily: 'var(--font-serif)',
      fontSize: 'var(--slide-body-size)',
      lineHeight: 1.4
    }
  }, paras.map((p, i) => /*#__PURE__*/React.createElement("p", {
    key: i,
    style: {
      margin: 0,
      textWrap: 'pretty'
    }
  }, p))), /*#__PURE__*/React.createElement(__ds_scope.SlideMeta, {
    items: [credit, page].filter(Boolean),
    position: "bottom",
    left: "522pt"
  }));
}
Object.assign(__ds_scope, { ImageSlide });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/slides/ImageSlide.jsx", error: String((e && e.message) || e) }); }

// components/slides/QuoteSlide.jsx
try { (() => {
function QuoteSlide({
  quote,
  attribution,
  meta = [],
  footer = [],
  size = '56pt'
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Slide, {
    tone: "mist",
    label: "Quote"
  }, /*#__PURE__*/React.createElement(__ds_scope.SlideMeta, {
    items: meta
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      position: 'absolute',
      left: '222pt',
      right: '48pt',
      top: '150pt',
      margin: 0,
      fontFamily: 'var(--font-serif)',
      fontStyle: 'italic',
      fontSize: size,
      lineHeight: 1.15,
      textWrap: 'pretty'
    }
  }, "\u201C", quote, "\u201D"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '222pt',
      bottom: '140pt',
      fontSize: '18pt',
      fontWeight: 600
    }
  }, attribution), /*#__PURE__*/React.createElement(__ds_scope.SlideMeta, {
    items: footer,
    position: "bottom"
  }));
}
Object.assign(__ds_scope, { QuoteSlide });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/slides/QuoteSlide.jsx", error: String((e && e.message) || e) }); }

// components/slides/TitleSlide.jsx
try { (() => {
function TitleSlide({
  label,
  place,
  title,
  meta = []
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Slide, {
    tone: "paper",
    label: "Title"
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '48pt',
      top: '48pt',
      fontSize: '12pt',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }, label), place && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: '48pt',
      top: '48pt',
      fontSize: '12pt',
      color: 'var(--graphite)'
    }
  }, place), /*#__PURE__*/React.createElement("h1", {
    style: {
      position: 'absolute',
      left: '48pt',
      width: '642pt',
      top: '176pt',
      margin: 0,
      fontSize: 'var(--slide-title-size)',
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '-0.03em',
      textWrap: 'pretty'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '48pt',
      right: '48pt',
      bottom: '48pt',
      borderTop: '1pt solid var(--ink)',
      paddingTop: '12pt',
      display: 'grid',
      gridTemplateColumns: 'repeat(' + (meta.length || 3) + ',1fr)',
      gap: '24pt',
      fontSize: '14pt',
      lineHeight: 1.35
    }
  }, meta.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4pt'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--graphite)'
    }
  }, m.label), /*#__PURE__*/React.createElement("span", null, m.value)))));
}
Object.assign(__ds_scope, { TitleSlide });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/slides/TitleSlide.jsx", error: String((e && e.message) || e) }); }

__ds_ns.ImagePlaceholder = __ds_scope.ImagePlaceholder;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.BarChart = __ds_scope.BarChart;

__ds_ns.GroupedBarChart = __ds_scope.GroupedBarChart;

__ds_ns.BlockQuote = __ds_scope.BlockQuote;

__ds_ns.CoverPage = __ds_scope.CoverPage;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.DocPage = __ds_scope.DocPage;

__ds_ns.Figure = __ds_scope.Figure;

__ds_ns.Footnotes = __ds_scope.Footnotes;

__ds_ns.Heading = __ds_scope.Heading;

__ds_ns.Paragraph = __ds_scope.Paragraph;

__ds_ns.ReferenceList = __ds_scope.ReferenceList;

__ds_ns.TableOfContents = __ds_scope.TableOfContents;

__ds_ns.ChartSlide = __ds_scope.ChartSlide;

__ds_ns.ClosingSlide = __ds_scope.ClosingSlide;

__ds_ns.ContentSlide = __ds_scope.ContentSlide;

__ds_ns.ImageSlide = __ds_scope.ImageSlide;

__ds_ns.QuoteSlide = __ds_scope.QuoteSlide;

__ds_ns.SectionDivider = __ds_scope.SectionDivider;

__ds_ns.Slide = __ds_scope.Slide;

__ds_ns.SlideMeta = __ds_scope.SlideMeta;

__ds_ns.TitleSlide = __ds_scope.TitleSlide;

})();
