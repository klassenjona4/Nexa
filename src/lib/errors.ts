// Maps API and database error codes to plain, factual messages.
const MESSAGES: Record<string, string> = {
  rate_limited: 'Too many attempts. Wait a while and try again.',
  invalid_input: 'Some of the information is not valid. Check the fields and try again.',
  unauthorised: 'Your session has ended. Sign in again.',
  forbidden: 'You do not have permission to do this.',
  not_found: 'This item no longer exists or you do not have access to it.',
  not_configured: 'This feature is not set up on the server yet.',
  email_failed: 'The email could not be sent. Try again in a few minutes.',
  sign_in_unavailable: 'Sign in is not available right now. Try again in a few minutes.',
  network: 'Nexa could not reach the server. Check your connection and try again.',
  server_error: 'Something went wrong on the server. Your data is not affected. Try again.',
  group_full: 'The group already has 8 members.',
  group_needs_owner: 'A group needs at least one owner. Make another member an owner first.',
  assignee_not_member: 'Tasks can only be assigned to members of the group.',
  invite_invalid: 'This invite link no longer works. Ask the group owner for a new link.',
  invite_used_up: 'This invite link has been used the maximum number of times. Ask the group owner for a new link.',
  invite_wrong_account: 'This invite was sent to a different email address. Sign in with the address the invite was sent to.',
  too_many_pending_invites: 'There are already as many pending invites as free places in the group. Revoke an invite or wait for people to join.',
  already_reviewed: 'You already responded to this task.',
  own_task: 'You cannot confirm or flag a task that is assigned to you or that you marked as done.',
  task_not_done: 'Teammates can respond after the task is marked as done.',
  task_done_locked: 'Move the task out of Done before you change its owner.',
  usage_limit_reached: 'This project has used all of its AI requests. You can unlock 3 more of each for 2 euro on the Pricing page.',
  plan_project_limit: 'Your free project is used. Unlock another project for 2 euro, or choose the monthly plan, on the Pricing page.',
  subscription_inactive: 'The monthly plan that paid for this project has ended. Subscribe again, or unlock this project for 2 euro, to use AI features. Your data is kept.',
  ai_daily_limit: 'Nexa has reached its limit for AI requests today. Try again tomorrow.',
  group_limit: 'You have created the maximum number of groups for today. Try again tomorrow.',
  project_limit: 'This group already has the maximum of 10 projects.',
  task_limit: 'This project already has the maximum of 300 tasks.',
  link_limit: 'This task already has the maximum of 50 links.',
  payload_too_large: 'The content is too large.',
};

export function errorMessage(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || MESSAGES.server_error!;
}
