import React, { useCallback, useState } from 'react'

export default function CopyCmd({ cmd }: { cmd: string }) {
    const [copied, setCopied] = useState(false)

    const copy = useCallback(() => {
        navigator.clipboard.writeText(cmd).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }, [cmd])

    return (
        <div className="dl-copy-cmd">
            <span className="dl-terminal-dot" />
            <span className="dl-terminal-dot" />
            <span className="dl-terminal-dot" />
            <code>$ {cmd}</code>
            <span className="dl-copy-btn" onClick={copy} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && copy()}>
                {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                )}
            </span>
        </div>
    )
}

