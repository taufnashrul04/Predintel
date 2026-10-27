import React from 'react'

export interface PanelProps {
  title?: string
  badge?: string
  badgeVariant?: 'brand' | 'warning' | 'success' | 'error' | 'gray'
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

// Follows card.md: rounded-xl, border-secondary, bg-primary, p-xl, shadow-xs
export function Panel({
  title,
  badge,
  badgeVariant = 'gray',
  actions,
  children,
  className = '',
  noPadding = false
}: PanelProps) {
  const badgeClasses = {
    brand: 'bg-utility-brand-50 text-utility-brand-700 border-utility-brand-200',
    warning: 'bg-utility-warning-50 text-utility-warning-700 border-utility-warning-200',
    success: 'bg-utility-success-50 text-utility-success-700 border-utility-success-200',
    error: 'bg-utility-error-50 text-utility-error-700 border-utility-error-200',
    gray: 'bg-secondary text-secondary border-secondary'
  }[badgeVariant]

  return (
    <section className={`rounded-xl border border-secondary bg-primary shadow-xs flex flex-col ${className}`}>
      {title && (
        <div className="h-12 px-xl border-b border-secondary flex items-center justify-between shrink-0">
          <div className="flex items-center gap-sm">
            <h3 className="text-sm uppercase font-semibold tracking-wider text-primary">{title}</h3>
            {badge && (
              <span className={`inline-flex items-center gap-xs rounded-full border px-md py-xxs text-xs font-medium font-mono ${badgeClasses}`}>
                {badge}
              </span>
            )}
          </div>
          {actions && <div className="flex items-center gap-sm">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? 'flex-1' : 'p-xl flex-1'}>{children}</div>
    </section>
  )
}

export interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  change?: string
  changePositive?: boolean
  indicatorColor?: string
}

// Follows card.md: section rounded-xl border border-secondary bg-primary p-xl shadow-xs
export function StatCard({
  label,
  value,
  subtext,
  change,
  changePositive,
  indicatorColor
}: StatCardProps) {
  return (
    <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs flex flex-col justify-between">
      <div>
        <div className="text-tertiary uppercase text-xs font-semibold tracking-wider mb-xxs flex items-center justify-between">
          <span>{label}</span>
          {indicatorColor && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: indicatorColor }}
            />
          )}
        </div>
        <div className="mt-md text-heading-xs font-mono font-semibold text-primary tracking-tight">
          {value}
        </div>
      </div>
      <div className="mt-md text-xs flex items-center justify-between">
        {change && (
          <span
            className={`font-mono font-semibold ${
              changePositive ? 'text-utility-success-700' : 'text-utility-error-700'
            }`}
          >
            {change}
          </span>
        )}
        {subtext && <span className="text-tertiary truncate">{subtext}</span>}
      </div>
    </section>
  )
}

// Follows badge.md: inline-flex items-center gap-xs rounded-full border px-md py-xxs text-xs font-medium
export function VenuePill({ venueId, name, color }: { venueId?: string; name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-xs rounded-full border border-secondary bg-secondary px-md py-xxs text-xs font-medium text-primary"
      title={venueId}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span>{name}</span>
    </span>
  )
}

// Follows badge.md tinted pill
export function ChangeBadge({ change }: { change: number }) {
  const isPos = change > 0
  const isZero = change === 0
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-full border px-md py-xxs text-xs font-medium font-mono ${
        isZero
          ? 'border-secondary bg-secondary text-tertiary'
          : isPos
          ? 'border-utility-success-200 bg-utility-success-50 text-utility-success-700'
          : 'border-utility-error-200 bg-utility-error-50 text-utility-error-700'
      }`}
    >
      {isPos ? `+${change.toFixed(1)}pp` : `${change.toFixed(1)}pp`}
    </span>
  )
}

export function TruncatedAddress({ address }: { address: string }) {
  const [copied, setCopied] = React.useState(false)

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-xs rounded-md bg-secondary px-md py-xs text-xs font-medium text-secondary hover:text-primary transition-colors group border border-secondary focus-visible:ring-2 focus-visible:ring-focus-ring"
      title="Click to copy address"
    >
      <span className="font-mono">{short}</span>
      <span className="text-quaternary group-hover:text-primary font-mono">
        {copied ? '✓' : '⧉'}
      </span>
    </button>
  )
}
