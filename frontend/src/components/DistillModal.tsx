import { useState, useRef, useCallback } from 'react'

const DOMAIN_TAGS = [
  '科技', '教育', '财经', '时政', '动漫', '旅行', '美食', '穿搭',
  '美妆', '抽象', '法律', '健身', '医疗', '职场', '心理',
]

const PLATFORM_TAGS = ['抖音', 'B站', '小红书', 'Youtube']

const COLORS = ['#A855F7', '#FF6B35', '#00C8FF', '#22C55E', '#FFD700', '#ff2d78', '#6366f1']

interface DistillModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: DistillFormData) => Promise<void>
}

export interface DistillFormData {
  mode: 'url' | 'file' | 'manual'
  url: string
  platform: string
  file: File | null
  name: string
  avatarFile: File | null
  domains: string[]
  customDomain: string
}

export default function DistillModal({ open, onClose, onSubmit }: DistillModalProps) {
  const [mode, setMode] = useState<'url' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [domains, setDomains] = useState<string[]>([])
  const [customDomain, setCustomDomain] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const toggleDomain = (d: string) =>
    setDomains(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const addCustomDomain = () => {
    const trimmed = customDomain.trim()
    if (trimmed && !domains.includes(trimmed)) {
      setDomains(prev => [...prev, trimmed])
      setCustomDomain('')
    }
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.json') || f.name.endsWith('.yaml') || f.name.endsWith('.yml'))) {
      setFile(f)
      setMode('file')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setMode('file')
    }
  }

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setAvatarFile(f)
      const reader = new FileReader()
      reader.onload = ev => setAvatarPreview(ev.target?.result as string)
      reader.readAsDataURL(f)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({
        mode: mode,
        url: url.trim(),
        platform,
        file,
        name: name.trim(),
        avatarFile,
        domains,
        customDomain: customDomain.trim(),
      })
      resetForm()
      onClose()
    } catch {
      // error handled by parent
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setMode('url')
    setUrl('')
    setPlatform('')
    setFile(null)
    setName('')
    setAvatarFile(null)
    setAvatarPreview(null)
    setDomains([])
    setCustomDomain('')
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#f2f2f2', borderRadius: 20, width: 480, maxHeight: '85vh',
          overflow: 'auto', padding: '28px 32px 24px', position: 'relative',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          scrollbarWidth: 'none',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16, width: 32, height: 32,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>

        {/* Title */}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 16px 0' }}>蒸馏方式</h2>

        {/* === Section 1: Avatar + Name (top) === */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <div
            onClick={() => avatarInputRef.current?.click()}
            style={{
              width: 56, height: 56, borderRadius: '50%', background: '#ddd',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, overflow: 'hidden',
              transition: 'background 0.15s',
            }}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 28, color: '#999', fontWeight: 300 }}>+</span>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarSelect}
            style={{ display: 'none' }}
          />
          <div style={{ flex: 1 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入博主名字..."
              style={{
                width: '100%', height: 40, background: '#e8e8e8', border: 'none',
                borderRadius: 20, padding: '0 16px', fontSize: 14, color: '#333',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 11, color: '#999', marginTop: 3, paddingLeft: 4 }}>上传头像</div>
          </div>
        </div>

        {/* === Section 2: URL input === */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: '12px 14px', marginBottom: 10,
          border: mode === 'url' ? '2px solid #333' : '2px solid transparent',
          position: 'relative',
        }}>
          <div
            style={{
              position: 'absolute', top: 12, right: 12, width: 22, height: 22,
              borderRadius: '50%', border: '2px solid #333',
              background: mode === 'url' ? '#333' : '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setMode('url')}
          >
            {mode === 'url' && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
            )}
          </div>

          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setMode('url') }}
            placeholder="粘贴博主主页链接，自动蒸馏ta的风格..."
            style={{
              width: '100%', height: 36, background: '#f5f5f5', border: 'none',
              borderRadius: 18, padding: '0 14px', fontSize: 13, color: '#333',
              outline: 'none', boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {PLATFORM_TAGS.map(p => (
              <button
                key={p}
                onClick={() => { setPlatform(platform === p ? '' : p); setMode('url') }}
                style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 13,
                  border: '1px solid #ccc', cursor: 'pointer',
                  background: platform === p ? '#333' : '#f0f0f0',
                  color: platform === p ? '#fff' : '#555',
                  transition: 'all 0.15s',
                }}
              >{p}</button>
            ))}
          </div>
        </div>

        {/* === Section 3: File upload === */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: '12px 14px', marginBottom: 10,
          border: mode === 'file' ? '2px solid #333' : '2px solid transparent',
          position: 'relative',
        }}>
          <div
            style={{
              position: 'absolute', top: 12, right: 12, width: 22, height: 22,
              borderRadius: '50%', border: '2px solid #333',
              background: mode === 'file' ? '#333' : '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setMode('file')}
          >
            {mode === 'file' && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
            )}
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#333' : '#ccc'}`,
              borderRadius: 10, padding: '14px 16px', textAlign: 'center',
              cursor: 'pointer', transition: 'border-color 0.15s',
              background: dragOver ? '#f9f9f9' : 'transparent',
            }}
          >
            {file ? (
              <div style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>{file.name}</div>
            ) : (
              <>
                <div style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>拖拽文件到这里！</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>选择文件</div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.yaml,.yml"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            支持 .json / .yaml 格式的skill配置文件
          </div>
        </div>

        {/* === Section 4: Domain tags === */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>
            所在领域（可多选）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DOMAIN_TAGS.map(d => (
              <button
                key={d}
                onClick={() => toggleDomain(d)}
                style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 13,
                  border: '1px solid #ccc', cursor: 'pointer',
                  background: domains.includes(d) ? '#333' : '#e8e8e8',
                  color: domains.includes(d) ? '#fff' : '#555',
                  transition: 'all 0.15s',
                }}
              >{d}</button>
            ))}
            <button
              onClick={addCustomDomain}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13,
                border: '1px solid #ccc', cursor: 'pointer',
                background: '#e8e8e8', color: '#555',
              }}
            >+</button>
          </div>
          {/* Custom domain input row (shown when + is clicked or always available) */}
          <input
            value={customDomain}
            onChange={e => setCustomDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomDomain()}
            placeholder="自定义领域标签..."
            style={{
              width: '100%', height: 36, background: '#e8e8e8', border: 'none',
              borderRadius: 18, padding: '0 14px', fontSize: 13, color: '#333',
              outline: 'none', boxSizing: 'border-box', marginTop: 8,
              display: customDomain || domains.length > 0 ? 'block' : 'none',
            }}
          />
        </div>

        {/* === Submit button === */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !name.trim()}
          style={{
            width: '100%', height: 48, borderRadius: 24, border: 'none',
            background: name.trim() ? '#111' : '#ccc',
            color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: name.trim() ? 'pointer' : 'default',
            letterSpacing: '0.05em',
            transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {submitting ? (
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
          ) : '开始蒸馏'}
        </button>
      </div>
    </div>
  )
}
