import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive' | 'danger';
type Common = { variant?: ButtonVariant; size?: 'md' | 'lg' | 'sm'; block?: boolean; children: ReactNode };

function classes({ variant = 'primary', size = 'md', block }: Omit<Common, 'children'>, extra?: string) {
  return [s.btn, s[variant], size === 'lg' ? s.lg : size === 'sm' ? s.sm : '', block ? s.block : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

export function Button({ variant, size, block, className, type = 'button', ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={classes({ variant, size, block }, className)} {...rest} />;
}

export function ButtonLink({ variant, size, block, className, ...rest }: Common & LinkProps) {
  return <Link className={classes({ variant, size, block }, className)} {...rest} />;
}
