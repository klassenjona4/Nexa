import { useState } from 'react';
import s from './VideoEmbed.module.css';

// A YouTube video that loads only when someone chooses to play it. Until then nothing is requested
// from YouTube, so visitors who do not play it send no data to Google. The privacy-enhanced domain
// (youtube-nocookie.com) is used once it plays.
export function VideoEmbed({ id, title, label, heading }: { id: string; title: string; label: string; heading: string }) {
  const [playing, setPlaying] = useState(false);
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <figure className={s.figure}>
      <div className={s.frame}>
        {playing ? (
          <iframe
            className={s.iframe}
            src={src}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className={s.poster}>
            <span className={s.posterLabel}>{label}</span>
            <p className={s.posterHeading}>{heading}</p>
            <button type="button" className={s.play} onClick={() => setPlaying(true)}>
              Play video <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
      <figcaption className={s.caption}>
        {playing ? (
          <>
            Playing from YouTube.{' '}
            <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">
              Open on YouTube
            </a>
          </>
        ) : (
          'The video plays from YouTube. Nothing is loaded from YouTube until you press Play.'
        )}
      </figcaption>
    </figure>
  );
}
