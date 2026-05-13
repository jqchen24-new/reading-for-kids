import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChoiceCards } from './components/ChoiceCards.jsx'
import { EndingScreen } from './components/EndingScreen.jsx'
import { SceneDisplay } from './components/SceneDisplay.jsx'
import { SetupScreen } from './components/SetupScreen.jsx'
import { useNarrator } from './hooks/useNarrator.js'
import { fetchSceneIllustration, fetchStoryScene } from './lib/storyEngine.js'
import { isIOSLikeDevice } from './lib/platform.js'

export default function App() {
  const [phase, setPhase] = useState('setup')
  const [genre, setGenre] = useState('Adventure')
  const [heroName, setHeroName] = useState('')
  const [choiceHistory, setChoiceHistory] = useState([])
  const [currentScene, setCurrentScene] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [illustrationUrl, setIllustrationUrl] = useState(null)
  const [illustrationStatus, setIllustrationStatus] = useState('idle')
  const [illustrationDisableCode, setIllustrationDisableCode] = useState(null)
  const illustrationsOffRef = useRef(false)

  const {
    speak,
    stop,
    togglePause,
    primePlaybackFromGesture,
    prefetchNarration,
    status: narratorStatus,
    supported: speechSupported,
    iosSpeechGestureOnly,
  } = useNarrator()

  const resolvedHero = useMemo(
    () => (heroName.trim() ? heroName.trim().slice(0, 40) : 'Hero'),
    [heroName],
  )

  useEffect(() => {
    if (!iosSpeechGestureOnly) return
    if (!currentScene?.narration?.trim()) return
    if (loading) return
    if (phase !== 'scene' && phase !== 'ending') return
    const t = window.setTimeout(() => {
      prefetchNarration(currentScene.narration.trim())
    }, 400)
    return () => window.clearTimeout(t)
  }, [currentScene?.narration, iosSpeechGestureOnly, loading, phase, prefetchNarration])

  useEffect(() => {
    if (iosSpeechGestureOnly) return
    if (!currentScene?.narration?.trim()) return
    if (loading) return
    if (phase === 'scene' || phase === 'ending') {
      speak(currentScene.narration)
    }
  }, [phase, currentScene?.narration, loading, speak, iosSpeechGestureOnly])

  useEffect(() => {
    if (illustrationsOffRef.current) return
    const narration = currentScene?.narration?.trim()
    if (!narration || (phase !== 'scene' && phase !== 'ending')) {
      return
    }

    const ac = new AbortController()
    setIllustrationStatus('loading')
    setIllustrationUrl(null)
    setIllustrationDisableCode(null)

    void fetchSceneIllustration({
      narration,
      genre,
      heroName: resolvedHero,
      signal: ac.signal,
    })
      .then((r) => {
        if (ac.signal.aborted) return
        if (r.disabled) {
          illustrationsOffRef.current = true
          setIllustrationStatus('off')
          setIllustrationUrl(null)
          setIllustrationDisableCode(r.disableCode ?? null)
          return
        }
        if (r.illustrationUrl) {
          setIllustrationUrl(r.illustrationUrl)
          setIllustrationStatus('ready')
        } else {
          setIllustrationStatus('idle')
        }
      })
      .catch((e) => {
        if (ac.signal.aborted || e?.name === 'AbortError') return
        setIllustrationStatus('error')
        setIllustrationUrl(null)
      })

    return () => ac.abort()
  }, [currentScene?.narration, phase, genre, resolvedHero])

  const startStory = useCallback(async () => {
    primePlaybackFromGesture()
    stop()
    setError(null)
    setLoading(true)
    if (typeof window !== 'undefined' && window.speechSynthesis && isIOSLikeDevice()) {
      void window.speechSynthesis.getVoices()
    }
    try {
      const scene = await fetchStoryScene({
        genre,
        heroName: resolvedHero,
        sceneNumber: 1,
        choiceHistory: [],
      })
      setChoiceHistory([])
      setCurrentScene(scene)
      setPhase(scene.isEnding ? 'ending' : 'scene')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the story.')
    } finally {
      setLoading(false)
    }
  }, [genre, resolvedHero, stop, primePlaybackFromGesture])

  const choose = useCallback(
    async (label) => {
      if (!currentScene || currentScene.isEnding || loading) return

      primePlaybackFromGesture()
      stop()
      const prevHistory = choiceHistory
      const nextHistory = [...prevHistory, label]
      setChoiceHistory(nextHistory)
      setLoading(true)
      setError(null)

      try {
        const scene = await fetchStoryScene({
          genre,
          heroName: resolvedHero,
          sceneNumber: nextHistory.length + 1,
          choiceHistory: nextHistory,
        })
        setCurrentScene(scene)
        if (scene.isEnding) {
          setPhase('ending')
        }
      } catch (e) {
        setChoiceHistory(prevHistory)
        setError(e instanceof Error ? e.message : 'Could not continue the story.')
      } finally {
        setLoading(false)
      }
    },
    [choiceHistory, currentScene, genre, loading, resolvedHero, stop, primePlaybackFromGesture],
  )

  const playAgain = useCallback(() => {
    illustrationsOffRef.current = false
    stop()
    setPhase('setup')
    setChoiceHistory([])
    setCurrentScene(null)
    setError(null)
    setIllustrationUrl(null)
    setIllustrationStatus('idle')
    setIllustrationDisableCode(null)
  }, [stop])

  const replayNarration = useCallback(() => {
    primePlaybackFromGesture()
    const text = currentScene?.narration?.trim()
    if (text) {
      speak(text)
    }
  }, [currentScene, speak, primePlaybackFromGesture])

  return (
    <div className="min-h-svh bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-svh max-w-3xl flex-col items-center pb-12 pt-4">
        {phase === 'setup' && (
          <SetupScreen
            genre={genre}
            onGenreChange={setGenre}
            heroName={heroName}
            onHeroNameChange={setHeroName}
            onStart={startStory}
            loading={loading}
            error={error}
          />
        )}

        {phase === 'scene' && currentScene && (
          <>
            {error && (
              <p
                className="mb-4 max-w-2xl rounded-xl border border-red-500/50 bg-red-950/40 px-4 py-3 text-center text-base text-red-200"
                role="alert"
              >
                {error}
              </p>
            )}
            <SceneDisplay
              narration={currentScene.narration}
              sceneLabel={`Scene ${choiceHistory.length + 1} of 6`}
              narratorStatus={narratorStatus}
              speechSupported={speechSupported}
              iosSpeechGestureOnly={iosSpeechGestureOnly}
              onNarratorReplay={replayNarration}
              onNarratorTogglePause={togglePause}
              onNarratorStop={stop}
              loading={loading}
              illustrationUrl={illustrationUrl}
              illustrationStatus={illustrationStatus}
              illustrationDisableCode={illustrationDisableCode}
            >
              {!currentScene.isEnding && (
                <ChoiceCards
                  choices={currentScene.choices}
                  onChoose={choose}
                  disabled={loading}
                />
              )}
            </SceneDisplay>
          </>
        )}

        {phase === 'ending' && currentScene && (
          <EndingScreen
            narration={currentScene.narration}
            narratorStatus={narratorStatus}
            speechSupported={speechSupported}
            iosSpeechGestureOnly={iosSpeechGestureOnly}
            onNarratorReplay={replayNarration}
            onNarratorTogglePause={togglePause}
            onNarratorStop={stop}
            onPlayAgain={playAgain}
            illustrationUrl={illustrationUrl}
            illustrationStatus={illustrationStatus}
            illustrationDisableCode={illustrationDisableCode}
          />
        )}
      </main>
    </div>
  )
}
