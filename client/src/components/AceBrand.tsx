const ACE_ERP_URL = "https://aceerp.aceelectronics.com";

interface AceBrandProps {
  /**
   * auto = follow theme (navy on light, white on dark)
   * white = force white lockup (dark backgrounds)
   * navy = force navy lockup (light backgrounds)
   */
  variant?: "auto" | "white" | "navy";
  /** Compact mark-only for collapsed sidebar */
  compact?: boolean;
  className?: string;
}

/**
 * Ace Electronics brand lockup.
 * Logo links to Ace ERP (same tab).
 */
export function AceBrand({
  compact = false,
  variant = "auto",
  className = "",
}: AceBrandProps) {
  return (
    <div className={`flex items-center min-w-0 ${className}`}>
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
    </div>
  );
}
