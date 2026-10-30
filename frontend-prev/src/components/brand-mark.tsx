type BrandMarkProps = {
    className?: string
}

export function BrandMark({ className = 'size-8' }: BrandMarkProps) {
    return <img src="/brand-mark.svg" alt="" aria-hidden="true" className={className} />
}
