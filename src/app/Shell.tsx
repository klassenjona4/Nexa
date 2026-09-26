import { type ReactNode, useEffect, useMemo } from 'react';
import { Link, matchPath, NavLink, Outlet, useLocation } from 'react-router';
import { Avatar } from '../components/Avatar';
import { ButtonLink } from '../components/Button';
import { Label } from '../components/Label';
import { useMyProjects } from '../lib/queries';
import { useBreakpoint } from '../lib/useBreakpoint';
import { useAuth } from './AuthProvider';
import s from './Shell.module.css';

export const PROJECT_NAV = [
  { key: 'board', label: 'Task board', short: 'Board' },
  { key: 'brief', label: 'Brief', short: 'Brief' },
  { key: 'proposal', label: 'Task proposal', short: 'Proposal' },
  { key: 'log', label: 'Contribution log', short: 'Log' },
  { key: 'statement', label: 'Contribution statement', short: 'Statement' },
  { key: 'invite', label: 'Invite members', short: 'Invite' },
  { key: 'calendar', label: 'Calendar feed', short: 'Calendar' },
  { key: 'settings', label: 'Group settings', short: 'Settings' },
] as const;

const TITLES: Record<string, string> = {
  brief: 'Brief',
  proposal: 'Task proposal',
  invite: 'Invite',
  log: 'Contribution log',
  statement: 'Statement',
  settings: 'Group settings',
  tasks: 'Task',
};
const BACK: Record<string, [string, string]> = {
  tasks: ['board', 'Board'],
  proposal: ['brief', 'Brief'],
  statement: ['log', 'Log'],
};

function useRouteInfo() {
  const { pathname } = useLocation();
  const project = matchPath('/p/:projectId/:section/*', pathname) ?? matchPath('/p/:projectId/:section', pathname);
  const projectId = project?.params.projectId;
  const section = project?.params.section ?? '';
  return { pathname, projectId, section };
}

export function AppShell() {
  const bp = useBreakpoint();
  const desktop = bp === 'desktop';
  const { user, profile, signOut } = useAuth();
  const projects = useMyProjects(user?.id);
  const { pathname, projectId, section } = useRouteInfo();
  const current = projects.data?.find((p) => p.id === projectId);
  const navProject = current ?? projects.data?.[projects.data.length - 1];
  const activeSection = section === 'tasks' ? 'board' : section;

  useEffect(() => {
    document.documentElement.dataset.bottomNav = desktop ? 'false' : 'true';
    return () => {
      delete document.documentElement.dataset.bottomNav;
    };
  }, [desktop]);

  const top = useMemo(() => {
    if (projectId) {
      const back = BACK[section];
      return {
        title: TITLES[section] ?? current?.group_name ?? '',
        back: back ? { to: `/p/${projectId}/${back[0]}`, label: back[1] } : null,
      };
    }
    if (pathname === '/projects/new') return { title: 'New project', back: { to: '/projects', label: 'Projects' } };
    if (pathname.startsWith('/account')) return { title: 'Account', back: null };
    return { title: 'Projects', back: null };
  }, [pathname, projectId, section, current?.group_name]);

  const bottomActive = pathname.startsWith('/account')
    ? 'account'
    : projectId && (section === 'log' || section === 'statement')
      ? 'log'
      : projectId
        ? 'board'
        : 'projects';

  return (
    <div className={s.shell}>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      {desktop ? (
        <nav aria-label="Main" className={s.sidebar}>
          <Link to="/projects" className={s.wordmark}>
            Nexa
          </Link>
          <ButtonLink to="/projects/new">New group and project</ButtonLink>
          <div className={s.navGroup}>
            <div className={s.navLabel}>
              <Label>Projects</Label>
            </div>
            {(projects.data ?? []).map((p) => (
              <Link key={p.id} to={`/p/${p.id}/board`} aria-current={p.id === projectId ? 'true' : undefined} className={[s.navItem, s.projectItem].join(' ')}>
                <span>{p.group_name}</span>
                <span className={s.projectModule}>{p.module_code || p.title}</span>
              </Link>
            ))}
          </div>
          {current ? (
            <div className={s.navGroup}>
              <div className={s.navLabel}>
                <Label>{current.group_name}</Label>
              </div>
              {PROJECT_NAV.map((n) => (
                <Link key={n.key} to={`/p/${current.id}/${n.key}`} aria-current={activeSection === n.key ? 'page' : undefined} className={s.navItem}>
                  {n.label}
                </Link>
              ))}
            </div>
          ) : null}
          <div className={s.sidebarFoot}>
            <NavLink to="/account" className={[s.navItem, s.account].join(' ')}>
              <Avatar name={profile?.full_name} />
              <span className={s.accountText}>
                <span className={s.accountName}>{profile?.full_name || 'Your account'}</span>
                <span className={s.projectModule}>Account settings</span>
              </span>
            </NavLink>
            <button type="button" className={s.signOut} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </nav>
      ) : null}

      <div className={s.column}>
        {!desktop ? (
          <header className={s.topbar}>
            {top.back ? (
              <Link to={top.back.to} className={s.back}>
                ← {top.back.label}
              </Link>
            ) : (
              <span className={s.topWordmark}>Nexa</span>
            )}
            <p className={s.topTitle}>{top.title}</p>
            <span className={s.topSpacer} />
          </header>
        ) : null}
        {!desktop && projectId ? (
          <nav aria-label="Project" className={s.subnav}>
            {PROJECT_NAV.map((n) => (
              <Link key={n.key} to={`/p/${projectId}/${n.key}`} aria-current={activeSection === n.key ? 'page' : undefined} className={s.subItem}>
                {n.short}
              </Link>
            ))}
          </nav>
        ) : null}
        <main id="main" tabIndex={-1} className={[s.main, !desktop ? s.withBottomNav : ''].join(' ')}>
          <Outlet />
        </main>
      </div>

      {!desktop ? (
        <nav aria-label="Main" className={s.bottomnav}>
          <Link to="/projects" aria-current={bottomActive === 'projects' ? 'page' : undefined} className={s.bottomItem}>
            Projects
          </Link>
          <Link to={navProject ? `/p/${navProject.id}/board` : '/projects'} aria-current={bottomActive === 'board' ? 'page' : undefined} className={s.bottomItem}>
            Board
          </Link>
          <Link to={navProject ? `/p/${navProject.id}/log` : '/projects'} aria-current={bottomActive === 'log' ? 'page' : undefined} className={s.bottomItem}>
            Log
          </Link>
          <Link to="/account" aria-current={bottomActive === 'account' ? 'page' : undefined} className={s.bottomItem}>
            Account
          </Link>
        </nav>
      ) : null}
    </div>
  );
}

export function PublicShell({ showSignIn = true, children }: { showSignIn?: boolean; children?: ReactNode }) {
  const { session } = useAuth();
  const { pathname } = useLocation();
  const onAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/auth/');
  return (
    <div className={s.shell}>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <div className={s.column}>
        <header className={s.publicBar}>
          <Link to="/" className={s.wordmark}>
            Nexa
          </Link>
          {showSignIn && !onAuthPage ? (
            session ? (
              <ButtonLink to="/projects" variant="secondary">
                Your projects
              </ButtonLink>
            ) : (
              <ButtonLink to="/sign-in" variant="secondary">
                Sign in
              </ButtonLink>
            )
          ) : null}
        </header>
        <main id="main" tabIndex={-1} className={s.main}>
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className={s.footer}>
      <span className={s.footerText}>Nexa · Cork, Ireland</span>
      <Link to="/privacy">Privacy policy</Link>
      <Link to="/terms">Terms of use</Link>
    </footer>
  );
}
