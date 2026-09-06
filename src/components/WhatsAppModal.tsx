'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  MessageSquare,
  Copy,
  Check,
  Smartphone,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Phone,
  User,
  FileText
} from 'lucide-react'
import {
  WhatsAppTarget,
  buildStatementWhatsAppDetails,
  sendWhatsAppMessage,
  normalizePhoneNumber
} from '@/lib/statementPdf'

interface WhatsAppModalProps {
  isOpen: boolean
  onClose: () => void
  statement: any
  customerPhone?: string | null
  customerName?: string | null
}

export function WhatsAppModal({
  isOpen,
  onClose,
  statement,
  customerPhone,
  customerName
}: WhatsAppModalProps) {
  const [phone, setPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [message, setMessage] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [preferredApp, setPreferredApp] = useState<string | null>(null)
  const [rememberChoice, setRememberChoice] = useState(false)

  // Load saved preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('printax_whatsapp_pref')
      if (saved) setPreferredApp(saved)
    } catch {}
  }, [])

  // Build message on open
  useEffect(() => {
    if (!isOpen || !statement) return

    let isMounted = true
    const fetchSettingsAndBuild = async () => {
      let settings: any = {}
      try {
        const sRes = await fetch('/api/settings')
        if (sRes.ok) settings = await sRes.json()
      } catch {}

      if (!isMounted) return

      const details = buildStatementWhatsAppDetails(
        statement,
        customerPhone,
        customerName,
        settings
      )

      setRecipientName(details.name)
      setPhone(details.phone)
      setMessage(details.message)
    }

    fetchSettingsAndBuild()
    return () => {
      isMounted = false
    }
  }, [isOpen, statement, customerPhone, customerName])

  if (!isOpen || !statement) return null

  const handleSend = (target: WhatsAppTarget) => {
    if (rememberChoice) {
      try {
        localStorage.setItem('printax_whatsapp_pref', target)
        setPreferredApp(target)
      } catch {}
    }

    sendWhatsAppMessage({
      phone,
      message,
      target
    })
    onClose()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      alert('Unable to copy message to clipboard automatically.')
    }
  }

  const clearPreference = (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      localStorage.removeItem('printax_whatsapp_pref')
      setPreferredApp(null)
      setRememberChoice(false)
    } catch {}
  }

  const totalFormatted = `Rs. ${(statement.totalAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '1.75rem',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          background: '#ffffff',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)'
              }}
            >
              <MessageSquare size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>
                Send via WhatsApp
              </h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Choose which WhatsApp app to open for this statement
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.4rem', borderRadius: '8px', color: '#94a3b8' }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Statement Overview Pill */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem'
          }}
        >
          <div>
            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <FileText size={13} /> {statement.statementNo}
            </span>
            <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <User size={13} /> {recipientName}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Total Due</div>
            <div style={{ fontWeight: 700, color: '#155e96', fontSize: '1rem' }}>
              {totalFormatted}
            </div>
          </div>
        </div>

        {/* Phone Number Input */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.4rem'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={13} /> Recipient Phone Number
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#94a3b8' }}>
              (e.g. 94771234567)
            </span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(normalizePhoneNumber(e.target.value))}
              placeholder="Enter phone with country code (94...)"
              className="form-control"
              style={{
                fontSize: '0.925rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                paddingLeft: '0.75rem'
              }}
            />
          </div>
          {!phone && (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#f59e0b' }}>
              ⚠️ No customer phone number on record. You can type one above or copy the message.
            </p>
          )}
        </div>

        {/* Selection Prompt */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
              Select WhatsApp Destination:
            </label>
            {preferredApp && (
              <button
                onClick={clearPreference}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.72rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Clear saved default
              </button>
            )}
          </div>
        </div>

        {/* App Options Grid: Only Normal WhatsApp vs WhatsApp Business */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
          {/* 1. Normal WhatsApp (Standard Messenger) */}
          <button
            type="button"
            onClick={() => handleSend('standard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '1.1rem 1rem',
              borderRadius: '12px',
              border: preferredApp === 'standard' ? '2px solid #25D366' : '1.5px solid #cbd5e1',
              background: preferredApp === 'standard' ? '#f0fdf4' : '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}
            className="hover-card"
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#25D366',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(37, 211, 102, 0.3)'
              }}
            >
              <Smartphone size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.975rem', color: '#0f172a' }}>
                  Normal WhatsApp
                </span>
                {preferredApp === 'standard' && (
                  <span style={{ fontSize: '0.65rem', background: '#22c55e', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                    DEFAULT
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.15rem' }}>
                Standard Messenger
              </div>
            </div>
          </button>

          {/* 2. WhatsApp Business */}
          <button
            type="button"
            onClick={() => handleSend('business')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '1.1rem 1rem',
              borderRadius: '12px',
              border: preferredApp === 'business' ? '2px solid #008069' : '1.5px solid #cbd5e1',
              background: preferredApp === 'business' ? '#f0fdf9' : '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}
            className="hover-card"
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#008069',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(0, 128, 105, 0.3)'
              }}
            >
              <Briefcase size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.975rem', color: '#0f172a' }}>
                  WhatsApp Business
                </span>
                {preferredApp === 'business' && (
                  <span style={{ fontSize: '0.65rem', background: '#008069', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                    DEFAULT
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.15rem' }}>
                Business Account App
              </div>
            </div>
          </button>
        </div>

        {/* Remember choice checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input
            type="checkbox"
            id="rememberChoice"
            checked={rememberChoice}
            onChange={e => setRememberChoice(e.target.checked)}
            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
          />
          <label
            htmlFor="rememberChoice"
            style={{ fontSize: '0.775rem', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}
          >
            Remember my selection as default on this device
          </label>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #e2e8f0', margin: '1rem 0' }} />

        {/* Secondary Actions: Copy Message & Preview */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: copied ? '#16a34a' : '#334155',
              borderColor: copied ? '#86efac' : '#cbd5e1',
              background: copied ? '#f0fdf4' : '#fff'
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Statement Copied!' : 'Copy Statement Text'}
          </button>

          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="btn btn-ghost btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              color: '#64748b'
            }}
          >
            {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showPreview ? 'Hide Preview' : 'Preview Message'}
          </button>
        </div>

        {/* Collapsible Message Preview */}
        {showPreview && (
          <div
            style={{
              marginTop: '0.85rem',
              background: '#0f172a',
              color: '#e2e8f0',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              maxHeight: '180px',
              overflowY: 'auto'
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
