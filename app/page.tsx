'use client'

import { useState, useRef, useEffect } from 'react'
import { FiSettings, FiMic, FiMicOff, FiVolume2, FiWifi, FiWifiOff } from 'react-icons/fi'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { MdEmail, MdExpandMore, MdExpandLess } from 'react-icons/md'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'

const THEME_VARS = {
  '--background': '20 30% 4%',
  '--foreground': '35 20% 90%',
  '--card': '20 25% 7%',
  '--card-foreground': '35 20% 90%',
  '--primary': '35 20% 90%',
  '--primary-foreground': '20 30% 4%',
  '--accent': '36 60% 31%',
  '--muted': '20 18% 15%',
  '--muted-foreground': '35 20% 70%',
  '--border': '20 18% 16%',
  '--destructive': '0 63% 31%',
  '--destructive-foreground': '35 20% 90%',
} as React.CSSProperties

const AGENT_ID = '698e4259a96cf8dd37d6a8a0'

type TranscriptMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

type EmailCard = {
  id: string
  sender: string
  subject: string
  keyPoints: string[]
  fullContent?: string
}

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'processing' | 'error'

function WaveformVisualizer({ status, volume }: { status: VoiceStatus; volume: number }) {
  const bars = 24
  const activeColors = {
    listening: 'bg-accent',
    speaking: 'bg-primary',
    processing: 'bg-muted-foreground',
    connecting: 'bg-muted',
    idle: 'bg-border',
    error: 'bg-destructive',
  }
  const color = activeColors[status] || 'bg-border'
  const isActive = status === 'listening' || status === 'speaking'

  return (
    <div className="flex items-center justify-center gap-1 h-24">
      {Array.from({ length: bars }).map((_, i) => {
        const heightPercent = isActive
          ? 20 + Math.sin((Date.now() / 200) + i * 0.5) * 30 + (volume * 50)
          : 10
        return (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all duration-150 ${color}`}
            style={{ height: `${heightPercent}%` }}
          />
        )
      })}
    </div>
  )
}

function EmailCardComponent({ email, onExpand }: { email: EmailCard; onExpand: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MdEmail className="text-accent shrink-0" size={16} />
              <span className="text-xs text-muted-foreground truncate">{email.sender}</span>
            </div>
            <h4 className="font-serif font-semibold text-sm text-foreground tracking-wide leading-relaxed">
              {email.subject}
            </h4>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {expanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {Array.isArray(email.keyPoints) && email.keyPoints.map((point, idx) => (
            <li key={idx} className="text-xs text-foreground/80 leading-relaxed tracking-wide flex">
              <span className="text-accent mr-2">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        {expanded && email.fullContent && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-foreground/70 leading-relaxed tracking-wide whitespace-pre-wrap">
              {email.fullContent}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TranscriptCard({ message }: { message: TranscriptMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] ${isUser ? 'ml-12' : 'mr-12'}`}>
        <Card className={`${isUser ? 'bg-accent/20 border-accent/30' : 'bg-card border-border'}`}>
          <CardContent className="p-3">
            <p className="text-sm text-foreground leading-relaxed tracking-wide font-serif">
              {message.text}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: VoiceStatus }) {
  const statusConfig = {
    idle: { text: 'Ready', icon: null, color: 'text-muted-foreground' },
    connecting: { text: 'Connecting...', icon: AiOutlineLoading3Quarters, color: 'text-accent animate-spin' },
    listening: { text: 'Listening...', icon: FiMic, color: 'text-accent' },
    speaking: { text: 'Speaking...', icon: FiVolume2, color: 'text-primary' },
    processing: { text: 'Processing...', icon: AiOutlineLoading3Quarters, color: 'text-muted-foreground animate-spin' },
    error: { text: 'Error', icon: null, color: 'text-destructive' },
  }
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2 text-xs tracking-wide">
      {Icon && <Icon className={config.color} size={14} />}
      <span className={config.color}>{config.text}</span>
    </div>
  )
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([])
  const [emails, setEmails] = useState<EmailCard[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState([80])
  const [currentVolume, setCurrentVolume] = useState(0)
  const [gmailConnected, setGmailConnected] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sampleRateRef = useRef(24000)
  const nextPlayTimeRef = useRef(0)
  const isMutedRef = useRef(false)
  const volumeRef = useRef(0.8)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    volumeRef.current = volume[0] / 100
  }, [volume])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (status === 'listening' || status === 'speaking') {
      interval = setInterval(() => {
        setCurrentVolume(Math.random() * 0.5 + 0.3)
      }, 100)
    } else {
      setCurrentVolume(0)
    }
    return () => clearInterval(interval)
  }, [status])

  const addTranscript = (role: 'user' | 'assistant', text: string) => {
    if (!text || !text.trim()) return
    setTranscript(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        role,
        text: text.trim(),
        timestamp: new Date(),
      },
    ])
  }

  const parseEmailsFromText = (text: string): EmailCard[] => {
    const emailCards: EmailCard[] = []
    const lines = text.split('\n')
    let currentEmail: Partial<EmailCard> | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? ''

      if (line.toLowerCase().includes('from:') || line.toLowerCase().includes('sender:')) {
        if (currentEmail && currentEmail.sender && currentEmail.subject) {
          emailCards.push({
            id: Date.now().toString() + Math.random(),
            sender: currentEmail.sender,
            subject: currentEmail.subject,
            keyPoints: currentEmail.keyPoints ?? [],
            fullContent: currentEmail.fullContent,
          })
        }
        currentEmail = { sender: line.split(':')[1]?.trim() ?? '', keyPoints: [] }
      } else if (line.toLowerCase().includes('subject:')) {
        if (currentEmail) {
          currentEmail.subject = line.split(':')[1]?.trim() ?? ''
        }
      } else if (line.startsWith('•') || line.startsWith('-')) {
        if (currentEmail && Array.isArray(currentEmail.keyPoints)) {
          currentEmail.keyPoints.push(line.replace(/^[•\-]\s*/, ''))
        }
      }
    }

    if (currentEmail && currentEmail.sender && currentEmail.subject) {
      emailCards.push({
        id: Date.now().toString() + Math.random(),
        sender: currentEmail.sender,
        subject: currentEmail.subject,
        keyPoints: currentEmail.keyPoints ?? [],
        fullContent: currentEmail.fullContent,
      })
    }

    return emailCards
  }

  const startConversation = async () => {
    try {
      setStatus('connecting')
      setError(null)

      const response = await fetch('https://voice-sip.studio.lyzr.ai/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: AGENT_ID }),
      })

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`)
      }

      const data = await response.json()
      const wsUrl = data?.wsUrl
      const sampleRate = data?.audioConfig?.sampleRate ?? 24000

      if (!wsUrl) {
        throw new Error('No WebSocket URL received from server')
      }

      sampleRateRef.current = sampleRate

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: sampleRate,
      })
      audioContextRef.current = audioContext

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      const silentGain = audioContext.createGain()
      silentGain.gain.value = 0
      silentGain.connect(audioContext.destination)

      source.connect(processor)
      processor.connect(silentGain)

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        setStatus('listening')
        nextPlayTimeRef.current = 0
      }

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'audio' && msg.audio) {
            setStatus('speaking')
            const audioData = Uint8Array.from(atob(msg.audio), c => c.charCodeAt(0))
            const audioBuffer = audioContext.createBuffer(1, audioData.length / 2, sampleRate)
            const channelData = audioBuffer.getChannelData(0)

            for (let i = 0; i < channelData.length; i++) {
              const int16 = (audioData[i * 2] ?? 0) | ((audioData[i * 2 + 1] ?? 0) << 8)
              channelData[i] = int16 < 0x8000 ? int16 / 0x8000 : (int16 - 0x10000) / 0x8000
            }

            const sourceNode = audioContext.createBufferSource()
            sourceNode.buffer = audioBuffer

            const gainNode = audioContext.createGain()
            gainNode.gain.value = volumeRef.current
            sourceNode.connect(gainNode)
            gainNode.connect(audioContext.destination)

            const now = audioContext.currentTime
            const startTime = Math.max(now, nextPlayTimeRef.current)
            sourceNode.start(startTime)
            nextPlayTimeRef.current = startTime + audioBuffer.duration

            sourceNode.onended = () => {
              setStatus('listening')
            }
          } else if (msg.type === 'transcript' && msg.text) {
            const text = msg.text
            if (msg.role === 'user') {
              addTranscript('user', text)
            } else {
              addTranscript('assistant', text)
              const parsedEmails = parseEmailsFromText(text)
              if (parsedEmails.length > 0) {
                setEmails(prev => [...prev, ...parsedEmails])
              }
            }
          } else if (msg.type === 'thinking') {
            setStatus('processing')
          } else if (msg.type === 'clear') {
            setStatus('listening')
          } else if (msg.type === 'error') {
            setError(msg.message ?? 'An error occurred')
            setStatus('error')
          }
        } catch (err) {
          console.error('Error processing message:', err)
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket error:', err)
        setError('Connection error occurred')
        setStatus('error')
      }

      ws.onclose = () => {
        setIsConnected(false)
        setStatus('idle')
        nextPlayTimeRef.current = 0
      }

      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN || isMutedRef.current) return

        const inputData = e.inputBuffer.getChannelData(0)
        const pcm16 = new Int16Array(inputData.length)

        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i] ?? 0))
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)))
        ws.send(JSON.stringify({
          type: 'audio',
          audio: base64,
          sampleRate: sampleRateRef.current,
        }))
      }
    } catch (err) {
      console.error('Error starting conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to start conversation')
      setStatus('error')
    }
  }

  const stopConversation = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsConnected(false)
    setStatus('idle')
    nextPlayTimeRef.current = 0
  }

  const handleToggleConversation = () => {
    if (isConnected) {
      stopConversation()
    } else {
      startConversation()
    }
  }

  return (
    <div style={THEME_VARS} className="min-h-screen bg-background text-foreground font-serif">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <header className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-wide">Gmail Voice Assistant</h1>
              <p className="text-xs text-muted-foreground mt-1 tracking-wide">
                Speak naturally to manage your emails
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                {gmailConnected ? (
                  <FiWifi className="text-accent" size={16} />
                ) : (
                  <FiWifiOff className="text-destructive" size={16} />
                )}
                <span className="text-xs tracking-wide">
                  {gmailConnected ? 'Gmail Connected' : 'Gmail Disconnected'}
                </span>
              </div>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <FiSettings size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-hidden">
          {/* Left Panel - Voice Visualizer & Controls */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <Card className="bg-card border-border flex-1 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-serif font-semibold tracking-wide">Voice Control</h2>
                  <StatusBadge status={status} />
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <WaveformVisualizer status={status} volume={currentVolume} />

                <div className="mt-8 text-center">
                  <button
                    onClick={handleToggleConversation}
                    disabled={status === 'connecting'}
                    className={`w-32 h-32 rounded-full transition-all duration-300 flex items-center justify-center mx-auto ${
                      isConnected
                        ? 'bg-destructive hover:bg-destructive/80 shadow-lg shadow-destructive/20'
                        : 'bg-accent hover:bg-accent/80 shadow-lg shadow-accent/20'
                    } ${status === 'connecting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {status === 'connecting' ? (
                      <AiOutlineLoading3Quarters className="text-foreground animate-spin" size={32} />
                    ) : isConnected ? (
                      <span className="text-foreground text-sm font-semibold tracking-wide">End Call</span>
                    ) : (
                      <span className="text-background text-sm font-semibold tracking-wide">Start Call</span>
                    )}
                  </button>
                  <p className="text-xs text-muted-foreground mt-4 tracking-wide">
                    {isConnected ? 'Click to end conversation' : 'Click to start voice conversation'}
                  </p>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-xs text-destructive tracking-wide">{error}</p>
                  </div>
                )}

                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tracking-wide">Microphone</span>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      disabled={!isConnected}
                      className={`p-2 rounded-lg transition-colors ${
                        isMuted ? 'bg-destructive/20 text-destructive' : 'bg-muted text-foreground'
                      } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/20'}`}
                    >
                      {isMuted ? <FiMicOff size={16} /> : <FiMic size={16} />}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground tracking-wide">Volume</span>
                      <span className="text-xs text-foreground tracking-wide">{volume[0]}%</span>
                    </div>
                    <Slider
                      value={volume}
                      onValueChange={setVolume}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <h3 className="text-sm font-serif font-semibold tracking-wide">Quick Commands</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs text-muted-foreground tracking-wide leading-relaxed">
                  <p>• "Read my latest emails"</p>
                  <p>• "Search for emails from [name]"</p>
                  <p>• "Tell me about the email from [sender]"</p>
                  <p>• "What are my unread messages?"</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - Conversation Transcript */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border h-full flex flex-col">
              <CardHeader className="pb-3">
                <h2 className="text-lg font-serif font-semibold tracking-wide">Conversation</h2>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  {transcript.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-muted-foreground tracking-wide text-center">
                        Start a conversation to see the transcript here
                      </p>
                    </div>
                  ) : (
                    <div>
                      {transcript.map(msg => (
                        <TranscriptCard key={msg.id} message={msg} />
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Email Cards */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border h-full flex flex-col">
              <CardHeader className="pb-3">
                <h2 className="text-lg font-serif font-semibold tracking-wide">Email Summary</h2>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  {emails.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-muted-foreground tracking-wide text-center">
                        Email summaries will appear here as the assistant reads them
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {emails.map(email => (
                        <EmailCardComponent
                          key={email.id}
                          email={email}
                          onExpand={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
