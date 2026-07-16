const ACE_ERP_URL = "https://aceerp.aceelectronics.com";

interface AceBrandProps {
  /** Show the "Customer Check in" label beside the logo */
  showProductName?: boolean;
  /** Compact mark-only for collapsed sidebar */
  compact?: boolean;
  /**
   * auto = follow theme (navy on light, white on dark)
   * white = force white lockup (dark backgrounds)
   * navy = force navy lockup (light backgrounds)
   */
  variant?: "auto" | "white" | "navy";
  className?: string;
}

/**
 * Ace Electronics brand lockup.
 * Only the logo is a link (opens Ace ERP in the same tab).
 * Product name sits beside it and is not part of the link.
 */
export function AceBrand({
  showProductName = true,
  compact = false,
  variant = "auto",
  className = "",
}: AceBrandProps) {
  const productNameClass =
    variant === "white"
      ? "text-white"
      : variant === "navy"
        ? "text-[hsl(220_100%_14%)]"
        : "text-foreground";

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <a
        href={ACE_ERP_URL}
        target="_self"
        rel="noopener noreferrer"
        className="shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="link-ace-logo"
        title="Open Ace ERP"
        aria-label="Ace Electronics — open Ace ERP"
      >
        {compact ? (
          <img
            src="/logos/ace-logo-idle.png"
            alt="Ace Electronics"
            className="h-8 w-8 object-contain"
          />
        ) : variant === "white" ? (
          <img
            src="/logos/ace-logo-white.png"
            alt="Ace Electronics"
            className="h-9 w-auto max-w-[140px] object-contain object-left"
          />
        ) : variant === "navy" ? (
          <img
            src="/logos/ace-logo-navy.png"
            alt="Ace Electronics"
            className="h-9 w-auto max-w-[140px] object-contain object-left"
          />
        ) : (
          <>
            <img
              src="/logos/ace-logo-navy.png"
              alt="Ace Electronics"
              className="h-9 w-auto max-w-[140px] object-contain object-left dark:hidden"
            />
            <img
              src="/logos/ace-logo-white.png"
              alt="Ace Electronics"
              className="hidden h-9 w-auto max-w-[140px] object-contain object-left dark:block"
            />
          </>
        )}
      </a>

      {showProductName && !compact && (
        <div className="min-w-0 border-l border-border pl-3 dark:border-white/20">
          <p className={`truncate text-sm font-semibold tracking-tight leading-tight ${productNameClass}`}>
            Customer Check in
          </p>
        </div>
      )}
    </div>
  );
}
