import { cn } from '@/lib/utils'

type CardVariant = 'default' | 'elevated' | 'bordered'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-[#1e1e1e] border border-[#27272a]',
  elevated: 'bg-[#141414] border border-[#1f1f22]',
  bordered: 'bg-transparent border border-[#27272a]',
}

function Card({ className, variant = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-lg', variantClasses[variant], className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1 p-6 pb-4', className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold text-[#f4f4f5] leading-tight', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-[#71717a]', className)} {...props} />
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-4', className)} {...props} />
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center px-6 pt-2 pb-5', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
