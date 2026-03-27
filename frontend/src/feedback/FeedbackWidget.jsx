import { useState } from 'react'
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { colors, font, spacing, radius } from '../theme'

// ── Typography helpers (match existing app style) ─────────────────
const mono = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: 2,
}
const serif = {
    fontFamily: "'Georgia', 'Times New Roman', serif",
}
const label = {
    ...mono,
    color: colors.textDim,
    marginBottom: spacing.sm,
    display: 'block',
}

// ── Sub-components ────────────────────────────────────────────────

function Divider() {
    return <div style={{ height: 1, background: colors.border, margin: `${spacing.md} 0 ${spacing.lg} 0` }} />
}

function LikertScale({ value, onChange, low, high }) {
    return (
        <div>
            <div style={{ display: 'flex', gap: spacing.xs, marginBottom: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                    <button
                        key={n}
                        onClick={() => onChange(n)}
                        style={{
                            flex: 1,
                            height: 36,
                            borderRadius: radius.sm,
                            border: `1px solid ${value === n ? colors.info : colors.border}`,
                            background: value === n ? `${colors.info}18` : colors.bgSurface,
                            color: value === n ? colors.info : colors.textDim,
                            cursor: 'pointer',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: font.md,
                            fontWeight: value === n ? 700 : 400,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {n}
                    </button>
                ))}
            </div>
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                ...mono, fontSize: 9, color: colors.textFaint, letterSpacing: 1,
            }}>
                <span>{low}</span>
                <span>{high}</span>
            </div>
        </div>
    )
}

function ChipSelect({ options, value, onChange, multi = false }) {
    function toggle(opt) {
        if (multi) {
            onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
        } else {
            onChange(value === opt ? null : opt)
        }
    }
    const isSelected = opt => multi ? value.includes(opt) : value === opt

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
            {options.map(opt => (
                <button
                    key={opt}
                    onClick={() => toggle(opt)}
                    style={{
                        padding: `6px 12px`,
                        borderRadius: radius.sm,
                        border: `1px solid ${isSelected(opt) ? colors.info : colors.border}`,
                        background: isSelected(opt) ? `${colors.info}18` : colors.bgSurface,
                        color: isSelected(opt) ? colors.info : colors.textDim,
                        cursor: 'pointer',
                        ...mono,
                        fontSize: 10,
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {opt}
                </button>
            ))}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────

export function FeedbackWidget({ sessionId, uid, claim }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(false)

    // Core (always shown when open)
    const [overallRating, setOverallRating] = useState(null)
    const [openText, setOpenText] = useState('')

    // Extended (shown when expanded)
    const [usefulnessRating, setUsefulnessRating] = useState(null)
    const [challengeRating, setChallengeRating] = useState(null) // kept in state, omitted from form per user selection
    const [wouldUseAgain, setWouldUseAgain] = useState(null)
    const [comparedToOthers, setComparedToOthers] = useState(null)
    const [startupStage, setStartupStage] = useState(null)
    const [referralSources, setReferralSources] = useState([])

    const canSubmit = overallRating !== null && !submitting

    async function handleSubmit() {
        if (!canSubmit) return
        setSubmitting(true)
        setError(false)
        try {
            const db = getFirestore()
            await addDoc(collection(db, 'feedback'), {
                // Session context
                sessionId: sessionId || null,
                uid: uid || null,
                claim: claim || null,
                timestamp: serverTimestamp(),

                // Core
                overallRating,
                openText: openText.trim() || null,

                // Extended (null if not expanded / not answered)
                usefulnessRating: usefulnessRating || null,
                wouldUseAgain: wouldUseAgain || null,
                comparedToOthers: comparedToOthers || null,
                startupStage: startupStage || null,
                referralSources: referralSources.length > 0 ? referralSources : null,

                // Study metadata
                expandedForm: isExpanded,
            })
            setSubmitted(true)
        } catch (err) {
            console.error('Feedback error:', err)
            setError(true)
        } finally {
            setSubmitting(false)
        }
    }

    // ── Submitted state ───────────────────────────────────────────
    if (submitted) {
        return (
            <div style={containerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{ fontSize: 14 }}>✓</span>
                    <span style={{ ...mono, color: colors.success }}>
                        Thanks — feedback recorded
                    </span>
                </div>
            </div>
        )
    }

    // ── Collapsed state ───────────────────────────────────────────
    if (!isOpen) {
        return (
            <div style={containerStyle}>
                <button
                    onClick={() => setIsOpen(true)}
                    style={headerButtonStyle}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                        <span style={{ fontSize: 14 }}>💬</span>
                        <span style={{ ...mono, color: colors.textMuted }}>
                            Share feedback on this session
                        </span>
                    </div>
                    <span style={{ ...mono, color: colors.textFaint, fontSize: 10 }}>▼</span>
                </button>
            </div>
        )
    }

    // ── Open state ────────────────────────────────────────────────
    return (
        <div style={containerStyle}>

            {/* Header */}
            <button onClick={() => setIsOpen(false)} style={headerButtonStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{ fontSize: 14 }}>💬</span>
                    <span style={{ ...mono, color: colors.textMuted }}>
                        Share feedback on this session
                    </span>
                </div>
                <span style={{ ...mono, color: colors.textFaint, fontSize: 10 }}>▲</span>
            </button>

            <Divider />

            {/* ── Core section ──────────────────────────────────── */}
            <div style={{ marginBottom: spacing.md }}>
                <span style={label}>Overall, how would you rate this session?</span>
                <LikertScale
                    value={overallRating}
                    onChange={setOverallRating}
                    low="Not useful"
                    high="Extremely useful"
                />
            </div>

            <div style={{ marginBottom: spacing.md }}>
                <span style={label}>Any immediate thoughts? (optional)</span>
                <textarea
                    value={openText}
                    onChange={e => setOpenText(e.target.value)}
                    placeholder="What worked? What didn't?"
                    rows={2}
                    style={textareaStyle}
                />
            </div>

            {/* ── Expand toggle ──────────────────────────────────── */}
            {!isExpanded && (
                <button
                    onClick={() => setIsExpanded(true)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        ...mono, color: colors.textFaint, fontSize: 10,
                        padding: 0, marginBottom: spacing.md,
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}
                >
                    <span>+</span>
                    <span>Add more detail — helps our research</span>
                </button>
            )}

            {/* ── Extended section ───────────────────────────────── */}
            {isExpanded && (
                <div>
                    <Divider />

                    <div style={{ ...mono, color: colors.textFaint, fontSize: 9, marginBottom: spacing.md, letterSpacing: 1.5 }}>
                        Extended feedback · ~2 min
                    </div>

                    {/* Usefulness */}
                    <div style={{ marginBottom: spacing.md }}>
                        <span style={label}>How useful was the adversarial debate format specifically?</span>
                        <LikertScale
                            value={usefulnessRating}
                            onChange={setUsefulnessRating}
                            low="Not useful"
                            high="Very useful"
                        />
                    </div>

                    {/* Compared to others */}
                    <div style={{ marginBottom: spacing.md }}>
                        <span style={label}>
                            Compared to other ways you've gotten feedback on this idea, this was…
                        </span>
                        <ChipSelect
                            options={['Much worse', 'Worse', 'About the same', 'Better', 'Much better']}
                            value={comparedToOthers}
                            onChange={setComparedToOthers}
                        />
                    </div>

                    {/* Would use again */}
                    <div style={{ marginBottom: spacing.md }}>
                        <span style={label}>Would you use Devil's Advocate again or recommend it?</span>
                        <ChipSelect
                            options={['Definitely not', 'Probably not', 'Maybe', 'Probably yes', 'Definitely yes']}
                            value={wouldUseAgain}
                            onChange={setWouldUseAgain}
                        />
                    </div>

                    <Divider />

                    <div style={{ ...mono, color: colors.textFaint, fontSize: 9, marginBottom: spacing.md, letterSpacing: 1.5 }}>
                        About you · optional
                    </div>

                    {/* Startup stage */}
                    <div style={{ marginBottom: spacing.md }}>
                        <span style={label}>Stage of your startup or idea</span>
                        <ChipSelect
                            options={['Just an idea', 'Building MVP', 'Launched / live', 'Not a startup']}
                            value={startupStage}
                            onChange={setStartupStage}
                        />
                    </div>

                    {/* Referral */}
                    <div style={{ marginBottom: spacing.md }}>
                        <span style={label}>How did you hear about this? (select all that apply)</span>
                        <ChipSelect
                            options={['COZAD / UIUC', 'Friend or colleague', 'Social media', 'Class / course', 'Other']}
                            value={referralSources}
                            onChange={setReferralSources}
                            multi
                        />
                    </div>
                </div>
            )}

            <Divider />



            {error && (
                <p style={{ ...mono, color: colors.accent, marginBottom: spacing.sm, fontSize: 10 }}>
                    Submission failed — try again
                </p>
            )}

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                    padding: '8px 20px',
                    background: canSubmit ? `${colors.info}18` : 'transparent',
                    color: canSubmit ? colors.info : colors.textGhost,
                    border: `1px solid ${canSubmit ? colors.info : colors.border}`,
                    borderRadius: radius.sm,
                    ...mono,
                    cursor: canSubmit ? 'pointer' : 'default',
                    opacity: canSubmit ? 1 : 0.5,
                    transition: 'all 0.15s ease',
                }}
            >
                {submitting ? 'Submitting...' : 'Submit feedback'}
            </button>

        </div>
    )
}

// ── Shared styles ─────────────────────────────────────────────────

const containerStyle = {
    marginTop: spacing.lg,
    background: colors.bgSurfaceAlt,
    border: `1px solid ${colors.borderSubtle}`,
    borderTop: `2px solid ${colors.info}`,
    borderRadius: radius.lg,
    padding: spacing.lg,
}

const headerButtonStyle = {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: 0,
}

const textareaStyle = {
    width: '100%',
    padding: spacing.sm,
    background: colors.bgSurface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textMuted,
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: font.sm,
    lineHeight: 1.5,
    resize: 'none',
    boxSizing: 'border-box',
    outline: 'none',
}