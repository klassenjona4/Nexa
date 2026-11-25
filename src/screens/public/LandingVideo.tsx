import { Link } from 'react-router';
import { useAuth } from '../../app/AuthProvider';
import { PublicFooter } from '../../app/Shell';
import p from '../../app/page.module.css';
import { ButtonLink } from '../../components/Button';
import { Label } from '../../components/Label';
import { VideoEmbed } from '../../components/VideoEmbed';
import s from './LandingVideo.module.css';

// The landing page with the launch video. The earlier version stays in Landing.tsx; App.tsx
// chooses which one is shown at /.
export const LAUNCH_VIDEO_ID = 'pztb9J6tM3g';

const STEPS = [
  {
    n: '01',
    title: 'Upload the brief',
    body: 'One member uploads the assignment brief as a PDF or pastes the text. Nexa extracts the deliverables, deadlines, word counts and marking criteria. You check and correct them.',
  },
  {
    n: '02',
    title: 'Split the tasks',
    body: 'Nexa proposes tasks with estimated hours and an even split. Members join with an invite link, take tasks on a shared board and attach links to their work.',
  },
  {
    n: '03',
    title: 'Export the statement',
    body: 'Completed tasks, file links and teammate confirmations are recorded in a contribution log. At the end the group exports a contribution statement for peer assessment.',
  },
];

// Example cards from the app, placed around the video. They show what each step produces.
const CARDS = [
  { key: 'brief', label: 'Brief read', main: '4 deliverables, 3 deadlines', detail: '2,500 words, 5 marking criteria' },
  { key: 'split', label: 'Tasks split', main: '12 tasks, 38\u00a0h', detail: 'Even split across 4 members' },
  { key: 'log', label: 'Contribution log', main: 'Literature review: done', detail: 'Confirmed by 2 teammates, 14:32' },
  { key: 'statement', label: 'Contribution statement', main: 'Exported as PDF', detail: 'One factual paragraph per member' },
];

export function LandingVideo() {
  const { session } = useAuth();
  return (
    <div className={[p.content, p.wide, s.page].join(' ')}>
      <section className={s.hero} aria-labelledby="landing-title">
        <Label>Group assignment planner</Label>
        <h1 id="landing-title" className={s.title}>
          <span className={s.titleLine}>Plan the group assignment.</span>
          <span className={s.titleItalic}>Record who did each part.</span>
        </h1>
        <p className={s.lead}>
          Nexa reads your assignment brief, proposes tasks with estimated hours and splits them evenly. Every completed task is recorded, and at the end your group exports a contribution statement for peer assessment.
        </p>
        <div className={s.actions}>
          {session ? (
            <ButtonLink to="/projects" size="lg">
              Your projects <span aria-hidden="true">→</span>
            </ButtonLink>
          ) : (
            <ButtonLink to="/sign-in" size="lg">
              Start free <span aria-hidden="true">→</span>
            </ButtonLink>
          )}
          <a href="#video" className={s.watch}>
            Watch the video
          </a>
        </div>
        <Link to="/join" className={s.invite}>
          I have an invite link
        </Link>
      </section>

      <section id="video" className={s.stage} aria-labelledby="video-title">
        <h2 id="video-title" className="visually-hidden">
          Nexa in under a minute
        </h2>
        <ul className={s.cards} aria-label="What Nexa produces">
          {CARDS.map((c) => (
            <li key={c.key} className={[s.card, s[c.key]].join(' ')}>
              <span className={s.cardLabel}>{c.label}</span>
              <span className={s.cardMain}>{c.main}</span>
              <span className={s.cardDetail}>{c.detail}</span>
            </li>
          ))}
        </ul>
        <div className={s.video}>
          <VideoEmbed id={LAUNCH_VIDEO_ID} title="Nexa explained in under a minute" label="Video · under a minute" heading="See how a group plans an assignment with Nexa." />
        </div>
        <p className={[s.side, s.sideLeft].join(' ')}>
          Free plan: 1 project with 1 brief breakdown and 1 contribution statement. <Link to="/pricing">See all plans</Link>
        </p>
        <p className={[s.side, s.sideRight].join(' ')}>Every task, file link and confirmation is recorded with a name, date and time.</p>
      </section>

      <section id="how" className={s.section} aria-labelledby="how-title">
        <h2 id="how-title" className={s.h2}>
          How it works
        </h2>
        <ol className={s.steps}>
          {STEPS.map((step) => (
            <li key={step.n} className={s.step}>
              <span className={s.stepNumber} aria-hidden="true">
                {step.n}
              </span>
              <h3 className={s.stepTitle}>
                <span className="visually-hidden">Step {Number(step.n)}: </span>
                {step.title}
              </h3>
              <p className={s.stepBody}>{step.body}</p>
            </li>
          ))}
        </ol>
        <p className={s.note}>Works in the browser and can be installed on your phone.</p>
      </section>
      <PublicFooter />
    </div>
  );
}
