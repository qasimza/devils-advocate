import { useState } from 'react'
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { colors, font, spacing, radius } from '../theme'

const mono = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: 2,
}

const serif = {
    fontFamily: "'Georgia', 'Times New Roman', serif",
}

export function FeedbackWidget({ sessionId, uid, claim }) {
    const [isOpen, setIsOpen] = useState(false)
    const [rating, setRating] = useState(null)
    const [text, setText] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(false)

    async function handleSubmit() {
        if (!rating) return
        setSubmitting(true)
        setError(false)
        try {
            const db = getFirestore()
            await addDoc(collection(db, 'feedback'), {
                rating,
                text: text.trim() || null,
                sessionId: sessionId || null,
                uid: uid || null,
                claim: claim || null,
                timestamp: serverTimestamp(),
            })
            setSubmitted(true)
        } catch (err) {
            console.error('Feedback error:', err)
            setError(true)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div style={{
            marginTop: spacing.lg,
            background: colors.bgSurfaceAlt,
            border: `1px solid ${colors.borderSubtle}`,
            borderTop: `2px solid ${colors.info}`,
            borderRadius: radius.lg,
            padding: spacing.lg,
        }}>
            <button
                onClick={() => setIsOpen(prev => !prev)}
                style={{
                    background: 'none', border: 'none', cursor: submitted ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: 0,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{ fontSize: 14 }}>{submitted ? '✓' : '💬'}</span>
                    <span style={{ ...mono, color: submitted ? colors.success : colors.textMuted }}>
                        {submitted ? 'Thanks for your feedback' : 'How was your experience?'}
                    </span>
                </div>
                {!submitted && (
                    <span style={{ ...mono, color: colors.textFaint, fontSize: 10 }}>
                        {isOpen ? '▲' : '▼'}
                    </span>
                )}
            </button>

            {isOpen && !submitted && (
                <div style={{ marginTop: spacing.md }}>
                    <div style={{ height: 1, background: colors.border, marginBottom: spacing.md }} />

                    <div style={{ ...mono, color: colors.textDim, marginBottom: spacing.sm }}>
                        Rate this session
                    </div>

                    <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
                        {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} onClick={() => setRating(n)} style={{
                                width: 40, height: 40,
                                borderRadius: radius.sm,
                                border: `1px solid ${rating === n ? colors.info : colors.border}`,
                                background: rating === n ? `${colors.info}18` : colors.bgSurface,
                                color: rating === n ? colors.info : colors.textDim,
                                cursor: 'pointer',
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: font.md,
                                fontWeight: rating === n ? 700 : 400,
                                transition: 'all 0.15s ease',
                            }}>
                                {n}
                            </button>
                        ))}
                    </div>

                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Anything we should know? (optional)"
                        rows={3}
                        style={{
                            width: '100%',
                            padding: spacing.sm,
                            background: colors.bgSurface,
                            border: `1px solid ${colors.border}`,
                            borderRadius: radius.sm,
                            color: colors.textMuted,
                            ...serif,
                            fontSize: font.sm,
                            lineHeight: 1.5,
                            resize: 'none',
                            boxSizing: 'border-box',
                            marginBottom: spacing.md,
                            outline: 'none',
                        }}
                    />

                    {error && (
                        <p style={{ ...mono, color: colors.accent, marginBottom: spacing.sm, fontSize: 10 }}>
                            Submission failed — try again
                        </p>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!rating || submitting}
                        style={{
                            padding: `8px 20px`,
                            background: !rating || submitting ? 'transparent' : `${colors.info}18`,
                            color: !rating || submitting ? colors.textGhost : colors.info,
                            border: `1px solid ${!rating || submitting ? colors.border : colors.info}`,
                            borderRadius: radius.sm,
                            ...mono,
                            cursor: !rating || submitting ? 'default' : 'pointer',
                            opacity: !rating || submitting ? 0.5 : 1,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {submitting ? 'Submitting...' : 'Submit'}
                    </button>
                </div>
            )}
        </div>
    )
}