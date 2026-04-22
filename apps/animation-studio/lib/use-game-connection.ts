import { useEffect, useMemo, useState } from "react"
import type { DevSyncGameRegistration } from "@blud/dev-sync"

type RuntimeSyncPushResponse = {
  animationDir: string
  animationPath: string
  game: DevSyncGameRegistration
  projectName: string
  projectSlug: string
}

type PushRuntimeBundleOptions = {
  bundle: {
    files: Array<{
      bytes: number[]
      mimeType: string
      path: string
    }>
  }
  gameId?: string
  metadata: {
    projectName: string
    projectSlug: string
  }
}

export function useGameConnection() {
  const [games, setGames] = useState<DevSyncGameRegistration[]>([])
  const [selectedGameId, setSelectedGameId] = useState<string>()
  const [isLoading, setIsLoading] = useState(true)
  const [isPushing, setIsPushing] = useState(false)
  const [error, setError] = useState<string>()
  const [lastPush, setLastPush] = useState<RuntimeSyncPushResponse>()
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let disposed = false
    let timer = 0

    const refresh = async () => {
      try {
        const response = await fetch("/api/editor-sync/games")
        if (!response.ok) {
          throw new Error("Failed to load live game connections.")
        }

        const payload = await response.json() as { games?: DevSyncGameRegistration[] }
        if (disposed) return

        setGames(payload.games ?? [])
        setError(undefined)
      } catch (refreshError) {
        if (!disposed) {
          setError(refreshError instanceof Error ? refreshError.message : "Failed to load live game connections.")
        }
      } finally {
        if (!disposed) {
          setIsLoading(false)
          timer = window.setTimeout(() => {
            void refresh()
          }, 2000)
        }
      }
    }

    void refresh()

    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
  }, [refreshToken])

  useEffect(() => {
    if (games.length === 0) {
      setSelectedGameId(undefined)
      return
    }

    if (!selectedGameId || !games.some((game) => game.id === selectedGameId)) {
      setSelectedGameId(games[0]?.id)
    }
  }, [games, selectedGameId])

  const activeGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? games[0],
    [games, selectedGameId],
  )

  const pushRuntimeBundle = async (options: PushRuntimeBundleOptions) => {
    setIsPushing(true)

    try {
      const response = await fetch("/api/editor-sync/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      })
      const payload = await response.json() as RuntimeSyncPushResponse & { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to push runtime bundle to game.")
      }

      setLastPush(payload)
      setError(undefined)
      setRefreshToken((current) => current + 1)
      window.parent.postMessage({ type: "wh-orchestrator:switch-view", view: "game" }, "*")
      return payload
    } catch (pushError) {
      const message = pushError instanceof Error ? pushError.message : "Failed to push runtime bundle to game."
      setError(message)
      throw pushError
    } finally {
      setIsPushing(false)
    }
  }

  return {
    activeGame,
    error,
    games,
    isLoading,
    isPushing,
    lastPush,
    pushRuntimeBundle,
    refresh: () => {
      setIsLoading(true)
      setRefreshToken((current) => current + 1)
    },
    selectedGameId,
    setSelectedGameId,
  }
}
