import { Link } from 'react-router';
import helpRaw from '../../../content/help.md?raw';
import p from '../../app/page.module.css';
import { PublicFooter } from '../../app/Shell';
import { Label } from '../../components/Label';
import { parseLegal } from '../../lib/legal';
import { useBreakpoint } from '../../lib/useBreakpoint';
import s from '../legal/Legal.module.css';

// The help text lives in content/help.md, which is also the help chat's only source.
const DOC = parseLegal(helpRaw);
const slug = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function Help() {
  const desktop = useBreakpoint() === 'desktop';
  return (
    <div className={p.content}>
      <div className={s.layout}>
        {desktop ? (
          <nav aria-label="Contents" className={s.toc}>
            <div style={{ paddingBottom: 8 }}>
              <Label>Contents</Label>
            </div>
            {DOC.sections.map((sec) => (
              <a key={sec.heading} href={`#${slug(sec.heading)}`} className={s.tocLink}>
                {sec.heading}
              </a>
            ))}
          </nav>
        ) : null}
        <article className={s.article}>
          <div className={p.stack} style={{ gap: 12 }}>
            <Label>Help</Label>
            <h1 className={p.h1}>How Nexa works</h1>
            <p className={s.meta}>Last updated {DOC.updated}</p>
            <p className={s.para}>
              Short answers about every part of Nexa. Prices are on the <Link to="/pricing">pricing page</Link>. You can also ask the help chat in the corner of the screen.
            </p>
          </div>
          {DOC.sections.map((sec) => (
            <section key={sec.heading} id={slug(sec.heading)} className={s.section} aria-labelledby={`${slug(sec.heading)}-h`}>
              <h2 id={`${slug(sec.heading)}-h`} className={s.heading}>
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
