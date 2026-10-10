import { PublicFooter } from '../../app/Shell';
import p from '../../app/page.module.css';
import { ButtonLink } from '../../components/Button';
import { Label } from '../../components/Label';
import s from './Landing.module.css';

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

export function Landing() {
  return (
    <div className={[p.content, p.wide, s.page].join(' ')}>
      <section className={s.hero} aria-labelledby="landing-title">
        <div className={s.heroText}>
          <Label>Group assignment planner</Label>
          <h1 id="landing-title" className={s.title}>
            Plan a group assignment and record who did each part
          </h1>
        </div>
        <div className={s.heroText}>
          <p className={s.lead}>
            Nexa reads your assignment brief, lists the deliverables, deadlines, word counts and marking criteria, and proposes tasks with estimated hours. Your group splits the tasks on a shared board. Every
            completed task, file link and confirmation is recorded, and at the end the group exports a contribution statement for peer assessment.
          </p>
          <div className={p.actions}>
            <ButtonLink to="/sign-in" size="lg">
              Sign in
            </ButtonLink>
            <ButtonLink to="/join" size="lg" variant="secondary">
              I have an invite link
            </ButtonLink>
          </div>
          <p className={s.note}>Free for students. Works in the browser and can be installed on your phone.</p>
        </div>
      </section>
      <section className={s.section} aria-labelledby="how-title">
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
      </section>
      <PublicFooter />
    </div>
  );
}
