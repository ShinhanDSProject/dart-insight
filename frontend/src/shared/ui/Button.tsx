import type { ComponentPropsWithoutRef } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cx } from '@/shared/lib/cx'

/** primary: 주요 행동 하나, secondary: 그 밖의 행동, link: 글자처럼 보이는 버튼(표·목록 안) */
export type ButtonVariant = 'primary' | 'secondary' | 'link'
/** lg: 검색창 옆처럼 큰 입력과 나란히 둘 때 */
export type ButtonSize = 'md' | 'lg'

interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

function buttonClass({ variant = 'secondary', size = 'md' }: ButtonStyleProps, className?: string): string {
  if (variant === 'link') return cx('link-button', className)
  return cx('button', `button--${variant}`, size === 'lg' && 'button--lg', className)
}

type ButtonProps = ButtonStyleProps & ComponentPropsWithoutRef<'button'>

/** 누르는 것은 항상 <button>(UI-4). type 기본값은 'button'. 켜고 끄는 버튼은 aria-pressed를 넘긴다. */
export function Button({ variant, size, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size }, className)} {...rest} />
}

/** 버튼 모양의 앱 안 링크(react-router Link) */
export function ButtonLink({ variant, size, className, ...rest }: ButtonStyleProps & LinkProps) {
  return <Link className={buttonClass({ variant, size }, className)} {...rest} />
}

/** 버튼 모양의 바깥 링크(<a href>). 새 창으로 열 때는 target·rel을 넘긴다. */
export function ButtonAnchor({ variant, size, className, ...rest }: ButtonStyleProps & ComponentPropsWithoutRef<'a'>) {
  return <a className={buttonClass({ variant, size }, className)} {...rest} />
}
