export type StatementInput = { label: string; title: string; period: string; sections: { heading: string; body: string }[]; members: string[] };

export function statementText(input: StatementInput): string {
  return [input.label, input.title, input.period, '', ...input.sections.flatMap((s) => [s.heading, s.body, '']), ...input.members.map((m) => `${m}: signature and date ____________________`)].join('\n');
}
