import { Link } from 'react-router';
import privacyRaw from '../../../legal/privacy.md?raw';
import termsRaw from '../../../legal/terms.md?raw';
import p from '../../app/page.module.css';
import { PublicFooter } from '../../app/Shell';
import { InlineNotice } from '../../components/Display';
import { Label } from '../../components/Label';
import { parseLegal } from '../../lib/legal';
import { useBreakpoint } from '../../lib/useBreakpoint';
import s from './Legal.module.css';

const DOCS = { privacy: parseLegal(privacyRaw), terms: parseLegal(termsRaw) };

export function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  const doc = DOCS[kind];
  const other = kind === 'privacy' ? { to: '/terms', title: DOCS.terms.title } : { to: '/privacy', title: DOCS.privacy.title };
  const desktop = useBreakpoint() === 'desktop';
  const id = (i: number) => `${kind}-${i + 1}`;
  return (
    <div className={p.content}>
      <div className={s.layout}>
        {desktop ? (
          <nav aria-label="Contents" className={s.toc}>
            <div style={{ paddingBottom: 8 }}>
              <Label>Contents</Label>
            </div>
            {doc.sections.map((sec, i) => (
              <a key={sec.heading} href={`#${id(i)}`} className={s.tocLink}>
                {String(i + 1).padStart(2, '0')} {sec.heading}
              </a>
            ))}
          </nav>
        ) : null}
        <article className={s.article}>
          <div className={p.stack} style={{ gap: 12 }}>
            <Label>Legal</Label>
            <h1 className={p.h1}>{doc.title}</h1>
            <p className={s.meta}>
              {doc.status === 'draft' ? 'Draft for legal review' : `Last updated ${doc.updated}`} · Version {doc.version}
            </p>
            <Link to={other.to} className={s.switch}>
              → {other.title}
            </Link>
          </div>
          {doc.notice ? <InlineNotice role="note">{doc.notice}</InlineNotice> : null}
          {doc.sections.map((sec, i) => (
            <section key={sec.heading} id={id(i)} className={s.section} aria-labelledby={`${id(i)}-h`}>
              <h2 id={`${id(i)}-h`} className={s.heading}>
                <span className={s.number}>{String(i + 1).padStart(2, '0')}</span>
                {sec.heading}
              </h2>
              {sec.blocks.map((b, j) =>
                b.type === 'p' ? (
                  <p key={j} className={s.para}>
                    {b.text}
                  </p>
                ) : (
                  <ul key={j} className={s.list}>
                    {b.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
          <PublicFooter />
        </article>
      </div>
    </div>
  );
}
