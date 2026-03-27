/**
 * useAudioRecorder.js
 *
 * Records a mixed audio track of both the user's mic and the agent's
 * playback into a single Blob, ready for Firebase Storage upload.
 *
 * Strategy:
 *   - Taps into the existing 24kHz playback AudioContext via a
 *     ChannelMergerNode → MediaStreamDestination pipeline.
 *   - Routes the raw mic MediaStream into that same context so the
 *     browser handles the 16kHz→24kHz upsampling automatically.
 *   - Each agent AudioBufferSourceNode is connected to the merger
 *     via connectAgentSource(), called from playAudioChunk().
 *   - MediaRecorder records the destination stream.
 *
 * Usage:
 *   const { initRecorder, connectAgentSource, startRecording,
 *           stopRecording, cleanup } = useAudioRecorder()
 */

import { useRef, useCallback } from 'react'

// ── MIME type negotiation ─────────────────────────────────────────

function getSupportedMimeType() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
    ]
    for (const type of candidates) {
        try {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
                return type
            }
        } catch {
            // isTypeSupported can throw in some environments
        }
    }
    return '' // let the browser choose
}

// ── Hook ──────────────────────────────────────────────────────────

export function useAudioRecorder() {
    const destinationRef    = useRef(null)  // MediaStreamDestination
    const mergerRef         = useRef(null)  // ChannelMergerNode
    const micSourceRef      = useRef(null)  // MediaStreamAudioSourceNode (mic → merger)
    const mediaRecorderRef  = useRef(null)  // MediaRecorder on destination.stream
    const chunksRef         = useRef([])    // accumulated Blob chunks
    const mimeTypeRef       = useRef('')    // resolved MIME type

    /**
     * initRecorder(audioCtx, micStream)
     *
     * Call this once per session after:
     *   1. audioContextRef.current (the 24kHz playback context) exists
     *   2. The raw mic MediaStream is available from getUserMedia
     *
     * Must be called before startRecording().
     */
    const initRecorder = useCallback((audioCtx, micStream) => {
        // Guard: already initialised or missing dependencies
        if (!audioCtx || !micStream) {
            console.warn('[AudioRecorder] initRecorder: missing audioCtx or micStream — skipping')
            return
        }
        if (mediaRecorderRef.current) {
            console.warn('[AudioRecorder] initRecorder: already initialised — call cleanup() first')
            return
        }

        try {
            // ChannelMerger: input 0 = mic, input 1 = agent
            const merger = audioCtx.createChannelMerger(2)
            const destination = audioCtx.createMediaStreamDestination()
            merger.connect(destination)

            // Mic: createMediaStreamSource in the playback context — browser resamples 16k→24k
            const micSource = audioCtx.createMediaStreamSource(micStream)
            micSource.connect(merger, 0, 0)

            mergerRef.current       = merger
            destinationRef.current  = destination
            micSourceRef.current    = micSource
            chunksRef.current       = []

            const mimeType = getSupportedMimeType()
            mimeTypeRef.current = mimeType

            const recorderOptions = mimeType
                ? { mimeType, audioBitsPerSecond: 64_000 }
                : { audioBitsPerSecond: 64_000 }

            const mr = new MediaRecorder(destination.stream, recorderOptions)

            mr.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            mr.onerror = (e) => {
                // Non-fatal — recording is best-effort
                console.error('[AudioRecorder] MediaRecorder error:', e.error ?? e)
            }

            mediaRecorderRef.current = mr
            console.log('[AudioRecorder] Initialised. MIME:', mimeType || '(browser default)')

        } catch (err) {
            console.error('[AudioRecorder] initRecorder failed — recording disabled for this session:', err)
            // Intentionally non-fatal: the app still works, just without audio capture
        }
    }, [])

    /**
     * connectAgentSource(sourceNode)
     *
     * Call this inside playAudioChunk(), just before source.start().
     * Routes each agent AudioBufferSourceNode into the merger (input 1).
     * Safe to call even if initRecorder failed (mergerRef will be null).
     */
    const connectAgentSource = useCallback((sourceNode) => {
        if (!mergerRef.current || !sourceNode) return
        try {
            sourceNode.connect(mergerRef.current, 0, 1)
        } catch (err) {
            // Non-fatal: this chunk won't appear in the recording but playback is unaffected
            console.warn('[AudioRecorder] connectAgentSource failed for one chunk:', err.message)
        }
    }, [])

    /**
     * startRecording()
     *
     * Begin collecting audio. Call after initRecorder().
     * Collects a new chunk every second so data isn't lost on abrupt ends.
     */
    const startRecording = useCallback(() => {
        const mr = mediaRecorderRef.current
        if (!mr) {
            console.warn('[AudioRecorder] startRecording: not initialised')
            return
        }
        if (mr.state !== 'inactive') {
            console.warn('[AudioRecorder] startRecording: already in state:', mr.state)
            return
        }
        try {
            mr.start(1_000) // timeslice = 1s
            console.log('[AudioRecorder] Recording started')
        } catch (err) {
            console.error('[AudioRecorder] startRecording failed:', err)
        }
    }, [])

    /**
     * stopRecording()
     *
     * Stop recording and return a Promise<Blob | null>.
     * MUST be called BEFORE resetLiveState() closes the AudioContext.
     *
     * Returns null if:
     *   - MediaRecorder was never started
     *   - No audio data was collected (e.g. session < 1 s)
     *   - An error occurred
     */
    const stopRecording = useCallback(() => {
        return new Promise((resolve) => {
            const mr = mediaRecorderRef.current
            if (!mr || mr.state === 'inactive') {
                console.warn('[AudioRecorder] stopRecording: nothing to stop')
                resolve(null)
                return
            }

            const timeoutId = setTimeout(() => {
                console.warn('[AudioRecorder] stopRecording timed out — returning partial data')
                const chunks = chunksRef.current
                const blob = chunks.length > 0
                    ? new Blob(chunks, { type: mimeTypeRef.current || 'audio/webm' })
                    : null
                resolve(blob?.size > 0 ? blob : null)
            }, 5_000)

            mr.onstop = () => {
                clearTimeout(timeoutId)
                const chunks = chunksRef.current
                chunksRef.current = []
                if (chunks.length === 0) {
                    console.warn('[AudioRecorder] stopRecording: no chunks collected')
                    resolve(null)
                    return
                }
                const blob = new Blob(chunks, { type: mimeTypeRef.current || 'audio/webm' })
                console.log(`[AudioRecorder] Stopped. Blob size: ${(blob.size / 1024).toFixed(1)} KB`)
                resolve(blob.size > 0 ? blob : null)
            }

            try {
                mr.stop()
            } catch (err) {
                clearTimeout(timeoutId)
                console.error('[AudioRecorder] stopRecording error:', err)
                resolve(null)
            }
        })
    }, [])

    /**
     * cleanup()
     *
     * Disconnect nodes and clear all refs.
     * Call inside resetLiveState(), AFTER stopRecording() has resolved.
     */
    const cleanup = useCallback(() => {
        try { micSourceRef.current?.disconnect() } catch { /* already disconnected */ }
        try { mergerRef.current?.disconnect()    } catch { /* already disconnected */ }

        micSourceRef.current    = null
        mergerRef.current       = null
        destinationRef.current  = null
        mediaRecorderRef.current = null
        mimeTypeRef.current     = ''
        chunksRef.current       = []
    }, [])

    return { initRecorder, connectAgentSource, startRecording, stopRecording, cleanup }
}
